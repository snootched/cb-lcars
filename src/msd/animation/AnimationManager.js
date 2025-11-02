/**
 * AnimationManager - Central orchestrator for the MSD animation system
 *
 * Responsibilities:
 * - Manage animation scopes per overlay
 * - Register and coordinate animations with triggers
 * - Integrate with DataSourceManager for reactive animations
 * - Integrate with RulesEngine for rule-triggered animations
 * - Provide Runtime/Debug API surface
 *
 * Architecture Integration:
 * - Initialized in SystemsManager Phase 5 (after AdvancedRenderer)
 * - Uses existing AnimationRegistry for performance caching
 * - Leverages existing anime.js v4 integration via window.cblcars.anim
 * - Works with existing preset system in cb-lcars-anim-presets.js
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { AnimationRegistry } from './AnimationRegistry.js';
import { TriggerManager } from './TriggerManager.js';
import { ActionHelpers } from '../renderer/ActionHelpers.js';

export class AnimationManager {
  constructor(systemsManager) {
    this.systemsManager = systemsManager;

    // Core components
    this.registry = new AnimationRegistry();
    this.scopes = new Map(); // overlayId -> { scope, overlay, activeAnimations, triggerManager }
    this.customPresets = new Map(); // preset_ref -> preset definition
    this.timelines = new Map(); // timelineId -> timeline instance

    // Animation tracking
    this.activeAnimations = new Map(); // overlayId -> Set<animation instances>
    this.registeredAnimations = new Map(); // overlayId -> animation definitions[]

    // Datasource subscriptions
    this.datasourceSubscriptions = new Map(); // datasource_id -> cleanup function

    // Deferred ActionHelpers attachment (for overlays with interactive triggers)
    this.pendingActionHelpers = new Map(); // overlayId -> { element, overlayConfig, actionConfig }

    // DOM root element (for reliable queries when elements become disconnected)
    this.mountEl = null;

    // State
    this.initialized = false;

    cblcarsLog.debug('[AnimationManager] Created');
  }

  /**
   * Initialize the animation system with overlay configurations
   * Called by SystemsManager after AdvancedRenderer is initialized
   *
   * @param {Array} overlays - Overlay configurations from merged config
   * @param {Object} options - Additional options
   * @param {Object} options.customPresets - User-defined animation_presets
   * @param {Object} options.timelines - Timeline configurations
   */
  async initialize(overlays = [], options = {}) {
    cblcarsLog.info('[AnimationManager] 🎬 Initializing animation system');

    try {
      // Store mount element for reliable DOM queries
      this.mountEl = this.systemsManager?.renderer?.mountEl;
      if (!this.mountEl) {
        cblcarsLog.warn('[AnimationManager] No mountEl available - DOM queries may fail');
      }

      // Store custom presets for resolution
      if (options.customPresets) {
        Object.entries(options.customPresets).forEach(([name, preset]) => {
          this.customPresets.set(name, preset);
          cblcarsLog.debug(`[AnimationManager] Registered custom preset: ${name}`);
        });
      }

      // Register animations from overlay configs (don't execute yet - overlays may not be rendered)
      overlays.forEach(overlay => {
        if (overlay.animations && Array.isArray(overlay.animations)) {
          this.registeredAnimations.set(overlay.id, overlay.animations);
          cblcarsLog.debug(`[AnimationManager] Registered ${overlay.animations.length} animations for overlay: ${overlay.id}`);
        }
      });

      // Store timeline configs (will be initialized when overlays are ready)
      if (options.timelines) {
        Object.entries(options.timelines).forEach(([timelineId, timelineConfig]) => {
          cblcarsLog.debug(`[AnimationManager] Stored timeline config: ${timelineId}`);
        });
        this.timelineConfigs = options.timelines;
      }

      this.initialized = true;

      // Expose to global namespace for Runtime/Debug API
      if (typeof window !== 'undefined') {
        window.cblcars = window.cblcars || {};
        window.cblcars.animationManager = this;
      }

      cblcarsLog.info('[AnimationManager] ✅ Animation system initialized', {
        overlaysWithAnimations: this.registeredAnimations.size,
        customPresets: this.customPresets.size,
        timelines: Object.keys(options.timelines || {}).length
      });

    } catch (error) {
      cblcarsLog.error('[AnimationManager] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Called by AdvancedRenderer when an overlay is rendered and ready for animations
   * Creates scope, registers triggers, and executes on_load animations
   *
   * @param {string} overlayId - Overlay identifier
   * @param {Element} element - Rendered DOM element
   * @param {Object} overlayConfig - Full overlay configuration
   */
  async onOverlayRendered(overlayId, element, overlayConfig = {}) {
    if (!element) {
      cblcarsLog.warn(`[AnimationManager] Cannot initialize animations for ${overlayId} - no element provided`);
      return;
    }

    cblcarsLog.debug(`[AnimationManager] 🎨 Overlay rendered: ${overlayId}`);

    try {
      // Create anime.js scope for this overlay
      const scope = this.createScopeForOverlay(overlayId, element);

      // Create trigger manager for this overlay
      const triggerManager = new TriggerManager(overlayId, element, this);

      // Store scope and trigger manager
      this.scopes.set(overlayId, {
        scope: scope,
        overlay: overlayConfig,
        element: element,
        activeAnimations: new Set(),
        triggerManager: triggerManager
      });

      // Get registered animations for this overlay
      const animations = this.registeredAnimations.get(overlayId) ||
                        overlayConfig.animations ||
                        [];

      if (animations.length === 0) {
        cblcarsLog.debug(`[AnimationManager] No animations registered for overlay: ${overlayId}`);
        return;
      }

      // Register each animation with its trigger
      for (const animDef of animations) {
        await this.registerAnimation(overlayId, animDef);
      }

      cblcarsLog.debug(`[AnimationManager] ✅ Initialized ${animations.length} animations for overlay: ${overlayId}`);

      // Check if this overlay needs ActionHelpers integration for interactive triggers
      const needsActionHelpers = this.overlayNeedsActionHelpers(animations, overlayConfig);

      if (needsActionHelpers) {
        const cardInstance = this.systemsManager?.cardInstance;

        if (cardInstance) {
          // Card instance available - attach immediately
          this.attachActionHelpersForOverlay(overlayId, element, overlayConfig);
        } else {
          // Card instance not yet set - defer attachment
          // Store overlayId and config, NOT the element (element reference may become stale)
          const actionConfig = this.buildActionConfigForOverlay(overlayConfig);
          this.pendingActionHelpers.set(overlayId, { overlayId, overlayConfig, actionConfig });
          cblcarsLog.debug(`[AnimationManager] 📌 Deferred ActionHelpers attachment for ${overlayId} (waiting for cardInstance)`);
        }
      }

    } catch (error) {
      cblcarsLog.error(`[AnimationManager] Failed to initialize animations for ${overlayId}:`, error);
    }
  }

  /**
   * Register an animation with its trigger
   *
   * @param {string} overlayId - Overlay identifier
   * @param {Object} animDef - Animation definition
   */
  async registerAnimation(overlayId, animDef) {
    const trigger = animDef.trigger || 'on_load';
    const scopeData = this.scopes.get(overlayId);

    if (!scopeData) {
      cblcarsLog.warn(`[AnimationManager] Cannot register animation - scope not found for overlay: ${overlayId}`);
      return;
    }

    cblcarsLog.debug(`[AnimationManager] Registering animation for ${overlayId} with trigger: ${trigger}`);

    // Resolve preset_ref to actual definition
    const resolvedAnimDef = this.resolveAnimationDefinition(animDef);

    // Register with trigger manager
    scopeData.triggerManager.register(trigger, resolvedAnimDef);

    // For on_load triggers, execute immediately
    if (trigger === 'on_load') {
      await this.playAnimation(overlayId, resolvedAnimDef);
    }
  }

  /**
   * Trigger all animations registered for a specific overlay and trigger type
   * This is called by ActionHelpers when interactive events occur
   *
   * @param {string} overlayId - Overlay identifier
   * @param {string} trigger - Trigger type (on_tap, on_hold, on_hover, etc.)
   */
  async triggerAnimations(overlayId, trigger) {
    const scopeData = this.scopes.get(overlayId);

    if (!scopeData) {
      cblcarsLog.warn(`[AnimationManager] Cannot trigger animations - overlay not found: ${overlayId}`);
      return;
    }

    // Get animations registered for this trigger from TriggerManager
    const triggerManager = scopeData.triggerManager;
    if (!triggerManager || !triggerManager.registrations.has(trigger)) {
      cblcarsLog.debug(`[AnimationManager] No animations registered for ${overlayId} on trigger: ${trigger}`);
      return;
    }

    const animations = triggerManager.registrations.get(trigger) || [];

    if (animations.length === 0) {
      cblcarsLog.debug(`[AnimationManager] No animations to trigger for ${overlayId} on ${trigger}`);
      return;
    }

    cblcarsLog.debug(`[AnimationManager] 🎬 Triggering ${animations.length} animation(s) for ${overlayId} on ${trigger}`);

    // Execute each animation
    for (const animDef of animations) {
      try {
        await this.playAnimation(overlayId, animDef);
      } catch (error) {
        cblcarsLog.error(`[AnimationManager] Failed to play animation for ${overlayId}:`, error);
      }
    }
  }

  /**
   * Check if overlay needs ActionHelpers integration for interactive triggers
   *
   * @param {Array} animations - Array of animation definitions
   * @param {Object} overlayConfig - Overlay configuration
   * @returns {boolean} True if ActionHelpers should be attached
   */
  overlayNeedsActionHelpers(animations, overlayConfig) {
    // Check if any animation uses interactive triggers
    const interactiveTriggers = ['on_tap', 'on_hold', 'on_hover', 'on_double_tap'];
    const hasInteractiveTrigger = animations.some(anim =>
      interactiveTriggers.includes(anim.trigger)
    );

    // If overlay has interactive animation triggers, AnimationManager should handle attachment
    // Even if overlay has actions defined, we still need to ensure animationManager is passed
    // AdvancedRenderer will also attach ActionHelpers if actions exist, but it will now pass animationManager too
    return hasInteractiveTrigger;
  }

  /**
   * Build action config for ActionHelpers from overlay configuration
   *
   * @param {Object} overlayConfig - Overlay configuration
   * @returns {Object|null} Action config object or null if no actions
   */
  buildActionConfigForOverlay(overlayConfig) {
    // For animation-only overlays, create minimal action config
    // ActionHelpers needs this structure to attach event listeners
    return {
      simple: {
        tap_action: overlayConfig.tap_action || { action: 'none' },
        hold_action: overlayConfig.hold_action || { action: 'none' },
        double_tap_action: overlayConfig.double_tap_action || { action: 'none' }
      }
    };
  }

  /**
   * Attach ActionHelpers for a specific overlay
   *
   * @param {string} overlayId - Overlay identifier
   * @param {Element} element - DOM element
   * @param {Object} overlayConfig - Overlay configuration
   */
  attachActionHelpersForOverlay(overlayId, element, overlayConfig) {
    const cardInstance = this.systemsManager?.cardInstance;

    if (!cardInstance) {
      cblcarsLog.warn(`[AnimationManager] Cannot attach ActionHelpers for ${overlayId} - no cardInstance`);
      return;
    }

    // Check if actions are already attached (by AdvancedRenderer)
    if (element.hasAttribute('data-actions-attached')) {
      cblcarsLog.debug(`[AnimationManager] ⏭️ ActionHelpers already attached for ${overlayId} (skipping duplicate)`);
      return;
    }

    const actionConfig = this.buildActionConfigForOverlay(overlayConfig);

    if (actionConfig) {
      cblcarsLog.debug(`[AnimationManager] 🔗 Attaching ActionHelpers for animated overlay: ${overlayId}`);

      // Attach actions with animationManager passed through options
      ActionHelpers.attachActions(
        element,
        overlayConfig,
        actionConfig,
        cardInstance,
        { animationManager: this }
      );

      cblcarsLog.debug(`[AnimationManager] ✅ ActionHelpers attached for ${overlayId}`);
    }
  }

  /**
   * Attach ActionHelpers for all pending overlays (called when cardInstance becomes available)
   * This is typically called from setCardInstance() in the pipeline API
   */
  attachPendingActionHelpers() {
    if (this.pendingActionHelpers.size === 0) {
      return;
    }

    const cardInstance = this.systemsManager?.cardInstance;

    if (!cardInstance) {
      cblcarsLog.warn(`[AnimationManager] Cannot attach pending ActionHelpers - no cardInstance available`);
      return;
    }

    cblcarsLog.debug(`[AnimationManager] 🔄 Attaching ${this.pendingActionHelpers.size} pending ActionHelpers...`);

    let attachedCount = 0;
    this.pendingActionHelpers.forEach(({ overlayId, overlayConfig, actionConfig }) => {
      try {
        // Look up the element fresh from the DOM (element reference may have become stale)
        const scopeData = this.scopes.get(overlayId);
        if (!scopeData) {
          cblcarsLog.warn(`[AnimationManager] Cannot attach ActionHelpers for ${overlayId} - scope not found`);
          return;
        }

        // Try to get element from scope first
        let element = scopeData.element;

        // Verify the element is still in the DOM
        if (!element || !element.isConnected) {
          // Use stored mountEl for reliable queries
          if (this.mountEl) {
            element = this.mountEl.querySelector(`[data-overlay-id="${overlayId}"]`);
          } else {
            // Fallback to element.getRootNode() if mountEl not available
            const root = element?.getRootNode() || document;
            element = root.querySelector(`[data-overlay-id="${overlayId}"]`);
          }
        }

        if (!element) {
          cblcarsLog.warn(`[AnimationManager] Cannot attach ActionHelpers for ${overlayId} - element not found in DOM`);
          return;
        }        ActionHelpers.attachActions(
          element,
          overlayConfig,
          actionConfig,
          cardInstance,
          { animationManager: this }
        );

        attachedCount++;
      } catch (error) {
        cblcarsLog.error(`[AnimationManager] Failed to attach ActionHelpers for ${overlayId}:`, error);
      }
    });

    // Clear pending queue
    this.pendingActionHelpers.clear();

    cblcarsLog.debug(`[AnimationManager] ✅ Attached ${attachedCount} pending ActionHelpers`);
  }

  /**
   * Resolve animation definition from preset or custom preset
   *
   * @param {Object} animDef - Raw animation definition
   * @returns {Object} Resolved animation definition
   */
  resolveAnimationDefinition(animDef) {
    let resolved = { ...animDef };

    // Check if preset refers to a custom preset
    if (animDef.preset) {
      const customPreset = this.customPresets.get(animDef.preset);
      if (customPreset) {
        // Get the base preset name from the custom preset
        const basePresetName = customPreset._basePreset || customPreset.preset || customPreset.type;

        // Merge: base preset params < custom preset params < animDef params
        resolved = {
          ...customPreset,
          ...animDef,
          preset: basePresetName // Use the base preset for execution
        };

        // Clean up internal fields
        delete resolved._basePreset;
        delete resolved.type;

        cblcarsLog.debug(`[AnimationManager] Resolved custom preset: ${animDef.preset} -> ${basePresetName}`);
      }
    }

    // Check for legacy preset_ref (backwards compatibility)
    if (animDef.preset_ref) {
      const customPreset = this.customPresets.get(animDef.preset_ref);
      if (customPreset) {
        const basePresetName = customPreset._basePreset || customPreset.preset || customPreset.type;
        resolved = {
          ...customPreset,
          ...animDef,
          preset: basePresetName
        };
        delete resolved.preset_ref;
        delete resolved._basePreset;
        delete resolved.type;
        cblcarsLog.debug(`[AnimationManager] Resolved preset_ref: ${animDef.preset_ref} -> ${basePresetName}`);
      } else {
        cblcarsLog.warn(`[AnimationManager] preset_ref not found: ${animDef.preset_ref}`);
      }
    }

    // Verify preset exists if specified
    if (resolved.preset) {
      const presetFn = window.cblcars?.anim?.presets?.[resolved.preset];
      if (!presetFn) {
        cblcarsLog.warn(`[AnimationManager] Unknown preset: ${resolved.preset}`);
      }
    }

    return resolved;
  }

  /**
   * Play an animation on an overlay
   *
   * @param {string} overlayId - Overlay identifier
   * @param {Object} animDef - Animation definition (already resolved)
   * @returns {Object|null} Animation instance
   */
  async playAnimation(overlayId, animDef) {
    const scopeData = this.scopes.get(overlayId);

    if (!scopeData) {
      cblcarsLog.warn(`[AnimationManager] Cannot play animation - overlay not found: ${overlayId}`);
      return null;
    }

    try {
      // Resolve datasource-driven parameters if needed
      const resolvedParams = await this.resolveDatasourceParams(animDef);
      const finalAnimDef = { ...animDef, ...resolvedParams };

      // Use existing animateElement helper for consistency
      const { animateElement } = window.cblcars.anim;

      if (!animateElement) {
        cblcarsLog.error('[AnimationManager] animateElement helper not found');
        return null;
      }

      // Get HASS context from SystemsManager
      const hass = this.systemsManager.getHass?.() || this.systemsManager._hass;

      // Build animation options for animateElement
      const animOptions = {
        type: finalAnimDef.preset || finalAnimDef.type,
        targets: scopeData.element,
        root: scopeData.element.getRootNode(),
        duration: finalAnimDef.duration,
        easing: finalAnimDef.easing,
        loop: finalAnimDef.loop,
        alternate: finalAnimDef.alternate,
        delay: finalAnimDef.delay,
        // Pass through preset-specific config
        ...finalAnimDef
      };

      // Execute animation via animateElement
      // Pass scopeData (which has .scope property) not just the raw scope
      await animateElement(scopeData, animOptions, hass);

      cblcarsLog.debug(`[AnimationManager] ▶️ Playing animation on ${overlayId}:`, {
        preset: finalAnimDef.preset,
        trigger: animDef.trigger,
        duration: finalAnimDef.duration
      });

      // Track active animation
      scopeData.activeAnimations.add(finalAnimDef);

      return finalAnimDef; // Return for API access

    } catch (error) {
      cblcarsLog.error(`[AnimationManager] Failed to play animation on ${overlayId}:`, error);
      return null;
    }
  }

  /**
   * Resolve datasource-driven parameters in animation definition
   *
   * @param {Object} animDef - Animation definition
   * @returns {Object} Resolved parameters
   */
  async resolveDatasourceParams(animDef) {
    const resolved = {};
    const dataSourceManager = this.systemsManager.dataSourceManager;

    if (!dataSourceManager) {
      return resolved;
    }

    // Get datasource value if specified
    let datasourceValue = null;
    if (animDef.datasource) {
      const datasource = dataSourceManager.getSource(animDef.datasource);
      if (datasource) {
        const currentData = datasource.getCurrentData();
        datasourceValue = currentData?.value;
      }
    }

    // Resolve template strings in parameters
    for (const [key, value] of Object.entries(animDef)) {
      if (typeof value === 'string' && this.isTemplate(value)) {
        // Build context for template resolution
        const context = {
          datasource: {
            value: datasourceValue
          },
          states: (entityId) => {
            const hass = this.systemsManager.getHass?.() || this.systemsManager._hass;
            return hass?.states?.[entityId]?.state;
          }
        };

        // Use TemplateProcessor if available
        // For now, do simple replacement (full template processor integration in Phase 2)
        let resolvedValue = value;
        if (datasourceValue !== null) {
          resolvedValue = value.replace(/\{\{\s*datasource\.value\s*\}\}/g, datasourceValue);
        }

        resolved[key] = resolvedValue;
      }
    }

    return resolved;
  }

  /**
   * Check if a string contains template syntax
   *
   * @param {string} str - String to check
   * @returns {boolean}
   */
  isTemplate(str) {
    return /\{\{.*\}\}|\{%.*%\}/.test(str);
  }

  /**
   * Create an anime.js scope for an overlay
   *
   * @param {string} overlayId - Overlay identifier
   * @param {Element} element - Overlay DOM element
   * @returns {Object} Anime.js scope
   */
  createScopeForOverlay(overlayId, element) {
    try {
      // Use global anime.js to create scope
      const anime = window.cblcars?.anim?.animejs;
      if (!anime || !anime.createScope) {
        cblcarsLog.error('[AnimationManager] Anime.js createScope not available');
        return null;
      }

      const scope = anime.createScope();

      // Store in global scopes map for compatibility
      if (window.cblcars?.anim?.scopes) {
        window.cblcars.anim.scopes.set(overlayId, scope);
      }

      cblcarsLog.debug(`[AnimationManager] Created scope for overlay: ${overlayId}`);

      return scope;

    } catch (error) {
      cblcarsLog.error(`[AnimationManager] Failed to create scope for ${overlayId}:`, error);
      return null;
    }
  }

  /**
   * Stop all animations on an overlay
   *
   * @param {string} overlayId - Overlay identifier
   */
  stopAnimation(overlayId) {
    const scopeData = this.scopes.get(overlayId);

    if (!scopeData) {
      cblcarsLog.warn(`[AnimationManager] Cannot stop animations - overlay not found: ${overlayId}`);
      return;
    }

    try {
      // Use scope's revert method to stop all animations
      if (scopeData.scope && scopeData.scope.revert) {
        scopeData.scope.revert();
      }

      // Clear active animations tracking
      scopeData.activeAnimations.clear();

      cblcarsLog.debug(`[AnimationManager] ⏹️ Stopped animations on overlay: ${overlayId}`);

    } catch (error) {
      cblcarsLog.error(`[AnimationManager] Failed to stop animations on ${overlayId}:`, error);
    }
  }

  /**
   * Pause animations on an overlay
   *
   * @param {string} overlayId - Overlay identifier
   */
  pauseOverlay(overlayId) {
    const scopeData = this.scopes.get(overlayId);

    if (!scopeData || !scopeData.scope) {
      cblcarsLog.warn(`[AnimationManager] Cannot pause - overlay not found: ${overlayId}`);
      return;
    }

    try {
      if (scopeData.scope.pause) {
        scopeData.scope.pause();
        cblcarsLog.debug(`[AnimationManager] ⏸️ Paused animations on overlay: ${overlayId}`);
      }
    } catch (error) {
      cblcarsLog.error(`[AnimationManager] Failed to pause animations on ${overlayId}:`, error);
    }
  }

  /**
   * Resume animations on an overlay
   *
   * @param {string} overlayId - Overlay identifier
   */
  resumeOverlay(overlayId) {
    const scopeData = this.scopes.get(overlayId);

    if (!scopeData || !scopeData.scope) {
      cblcarsLog.warn(`[AnimationManager] Cannot resume - overlay not found: ${overlayId}`);
      return;
    }

    try {
      if (scopeData.scope.play) {
        scopeData.scope.play();
        cblcarsLog.debug(`[AnimationManager] ▶️ Resumed animations on overlay: ${overlayId}`);
      }
    } catch (error) {
      cblcarsLog.error(`[AnimationManager] Failed to resume animations on ${overlayId}:`, error);
    }
  }

  /**
   * Destroy scope and cleanup for an overlay
   * Called when overlay is removed
   *
   * @param {string} overlayId - Overlay identifier
   */
  destroyOverlayScope(overlayId) {
    const scopeData = this.scopes.get(overlayId);

    if (!scopeData) {
      return;
    }

    try {
      // Cleanup trigger manager
      if (scopeData.triggerManager) {
        scopeData.triggerManager.destroy();
      }

      // Revert and cleanup scope
      if (scopeData.scope && scopeData.scope.revert) {
        scopeData.scope.revert();
      }

      // Remove from maps
      this.scopes.delete(overlayId);
      this.activeAnimations.delete(overlayId);

      // Cleanup global scope reference
      if (window.cblcars?.anim?.scopes) {
        window.cblcars.anim.scopes.delete(overlayId);
      }

      cblcarsLog.debug(`[AnimationManager] 🗑️ Destroyed scope for overlay: ${overlayId}`);

    } catch (error) {
      cblcarsLog.error(`[AnimationManager] Failed to destroy scope for ${overlayId}:`, error);
    }
  }

  /**
   * Get all active animations (for Debug API)
   *
   * @returns {Object} Active animations by overlay
   */
  getActiveAnimations() {
    const result = {};

    this.scopes.forEach((scopeData, overlayId) => {
      if (scopeData.activeAnimations.size > 0) {
        result[overlayId] = Array.from(scopeData.activeAnimations).map(anim => ({
          preset: anim.preset,
          trigger: anim.trigger,
          duration: anim.duration
        }));
      }
    });

    return result;
  }

  /**
   * Get all registered animation definitions (for Debug API)
   *
   * @returns {Array} Animation definitions
   */
  getAllAnimationDefinitions() {
    const result = [];

    this.registeredAnimations.forEach((animations, overlayId) => {
      animations.forEach(animDef => {
        result.push({
          overlayId,
          ...animDef
        });
      });
    });

    return result;
  }

  /**
   * Inspect a specific overlay's animation state (for Debug API)
   *
   * @param {string} overlayId - Overlay identifier
   * @returns {Object|null} Overlay animation state
   */
  inspectOverlay(overlayId) {
    const scopeData = this.scopes.get(overlayId);

    if (!scopeData) {
      return null;
    }

    return {
      overlayId,
      hasScope: !!scopeData.scope,
      activeAnimations: Array.from(scopeData.activeAnimations),
      registeredAnimations: this.registeredAnimations.get(overlayId) || [],
      hasTriggerManager: !!scopeData.triggerManager
    };
  }

  /**
   * Cleanup all resources
   */
  dispose() {
    cblcarsLog.info('[AnimationManager] 🧹 Disposing animation system');

    // Cleanup all datasource subscriptions
    this.datasourceSubscriptions.forEach(cleanup => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    });
    this.datasourceSubscriptions.clear();

    // Destroy all overlay scopes
    Array.from(this.scopes.keys()).forEach(overlayId => {
      this.destroyOverlayScope(overlayId);
    });

    // Clear all maps
    this.scopes.clear();
    this.customPresets.clear();
    this.timelines.clear();
    this.activeAnimations.clear();
    this.registeredAnimations.clear();

    this.initialized = false;

    cblcarsLog.info('[AnimationManager] ✅ Animation system disposed');
  }
}
