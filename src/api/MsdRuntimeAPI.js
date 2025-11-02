/**
 * MSD Runtime API - User-facing stable API
 *
 * Provides high-level operations for dashboard builders and integrations.
 * All methods are safe for user scripts and automations.
 *
 * Design principle: Future-ready for multi-instance support
 * - All methods accept optional `cardId` parameter
 * - Phase 0: Single-instance (uses MsdInstanceManager.getCurrentInstance())
 * - Phase X: Multi-instance (cardId selects specific instance)
 *
 * @module MsdRuntimeAPI
 */

import { cblcarsLog } from '../utils/cb-lcars-logging.js';
import { MsdInstanceManager } from '../msd/pipeline/MsdInstanceManager.js';
import { MsdIntrospection } from '../msd/introspection/MsdIntrospection.js';

export class MsdRuntimeAPI {
  /**
   * Create and return the Runtime API object
   *
   * This method constructs the complete Runtime API with all methods
   * organized into logical namespaces.
   *
   * @returns {Object} Complete Runtime API object
   */
  static create() {
    return {
      // ==========================================
      // INSTANCE MANAGEMENT
      // ==========================================

      /**
       * Get MSD instance by ID
       *
       * Currently returns single global instance (multi-instance in Phase X)
       *
       * @param {string} [cardId] - Card ID (ignored in Phase 0, future-ready)
       * @returns {Object|null} Pipeline API instance or null if not available
       *
       * @example
       * const instance = window.cblcars.msd.getInstance();
       * console.log('Instance:', instance);
       */
      getInstance(cardId = null) {
        try {
          const instance = MsdInstanceManager.getCurrentInstance();

          if (!instance) {
            cblcarsLog.debug('[RuntimeAPI] No MSD instance available');
            return null;
          }

          // In Phase X, we'd use cardId to select specific instance
          // For now, just log if cardId was provided (for future compatibility testing)
          if (cardId) {
            cblcarsLog.debug('[RuntimeAPI] cardId parameter provided but ignored in single-instance mode:', cardId);
          }

          return instance;
        } catch (error) {
          cblcarsLog.error('[RuntimeAPI] Error getting instance:', error);
          return null;
        }
      },

      /**
       * Get current/active MSD instance
       *
       * Convenience method that always returns the current instance.
       * Equivalent to getInstance() without parameters.
       *
       * @returns {Object|null} Current pipeline API instance
       *
       * @example
       * const current = window.cblcars.msd.getCurrentInstance();
       * if (current) {
       *   console.log('MSD is active');
       * }
       */
      getCurrentInstance() {
        return MsdRuntimeAPI.create().getInstance();
      },

      /**
       * Get all MSD instances
       *
       * Currently returns array with single instance (multi-instance in Phase X)
       *
       * @returns {Array} Array of pipeline instances (length 0 or 1 in Phase 0)
       *
       * @example
       * const instances = window.cblcars.msd.getAllInstances();
       * console.log(`Found ${instances.length} instance(s)`);
       */
      getAllInstances() {
        const current = MsdRuntimeAPI.create().getInstance();
        return current ? [current] : [];
      },

      // ==========================================
      // STATE & CONFIGURATION
      // ==========================================

      /**
       * Get current card state
       *
       * Returns a summary of the current MSD state including overlay count,
       * anchor count, and debug status.
       *
       * @param {string} [cardId] - Card ID (optional, ignored in Phase 0)
       * @returns {Object|null} State object or null if instance not available
       *
       * @example
       * const state = window.cblcars.msd.getState();
       * console.log('Overlays:', state.overlays);
       * console.log('Anchors:', state.anchors);
       */
      getState(cardId = null) {
        try {
          const instance = MsdRuntimeAPI.create().getInstance(cardId);
          if (!instance) return null;

          // Get resolved model as a proxy for state
          const model = instance.getResolvedModel?.();
          if (!model) return null;

          return {
            overlays: model.overlays?.length || 0,
            anchors: Object.keys(model.anchors || {}).length,
            hasDebug: !!model.debug?.enabled,
            hasBaseSvg: !!model.base_svg
          };
        } catch (error) {
          cblcarsLog.error('[RuntimeAPI] Error getting state:', error);
          return null;
        }
      },

      /**
       * Get current configuration (resolved model)
       *
       * Returns the complete resolved configuration model. This is the final
       * configuration after all processing, merging, and resolution.
       *
       * @param {string} [cardId] - Card ID (optional, ignored in Phase 0)
       * @returns {Object|null} Configuration object or null
       *
       * @example
       * const config = window.cblcars.msd.getConfig();
       * console.log('Base SVG:', config.base_svg);
       * console.log('Overlays:', config.overlays);
       */
      getConfig(cardId = null) {
        try {
          const instance = MsdRuntimeAPI.create().getInstance(cardId);
          if (!instance) return null;

          const model = instance.getResolvedModel?.();
          return model || null;
        } catch (error) {
          cblcarsLog.error('[RuntimeAPI] Error getting config:', error);
          return null;
        }
      },

      /**
       * Validate current configuration
       *
       * Returns validation results from the MSD validation system.
       * This includes comprehensive schema validation, overlay validation,
       * and cross-reference checking performed during pipeline processing.
       *
       * @param {string} [cardId] - Card ID (optional, ignored in Phase 0)
       * @returns {Object} Validation result with success flag, errors, and warnings
       *
       * @example
       * const result = window.cblcars.msd.validate();
       * if (!result.success) {
       *   console.error('Validation errors:', result.errors);
       *   console.warn('Validation warnings:', result.warnings);
       * }
       *
       * // Detailed overlay validation
       * result.overlays.forEach(overlay => {
       *   if (!overlay.valid) {
       *     console.error(`Overlay ${overlay.overlayId}: ${overlay.errors}`);
       *   }
       * });
       */
      validate(cardId = null) {
        try {
          const instance = MsdRuntimeAPI.create().getInstance(cardId);

          if (!instance) {
            return {
              success: false,
              error: {
                code: 'MSD_INSTANCE_NOT_FOUND',
                message: 'No MSD instance available'
              }
            };
          }

          // Get the resolved model with validation results
          const model = instance.getResolvedModel?.();

          if (!model) {
            return {
              success: false,
              error: {
                code: 'NO_RESOLVED_MODEL',
                message: 'No resolved model available'
              }
            };
          }

          // Return existing validation results from the pipeline
          // These are generated by validateMerged() and ValidationService during pipeline processing
          // Validation is stored in mergedConfig, which is accessible via resolvedModel.config
          const validation = model.config?.__validation || model.__validation;

          if (validation) {
            return {
              success: validation.summary?.errors === 0,
              timestamp: validation.timestamp,
              summary: validation.summary,
              overlays: validation.results || [],
              message: validation.summary?.errors === 0
                ? 'Configuration is valid'
                : `Found ${validation.summary.errors} error(s) and ${validation.summary.warnings} warning(s)`
            };
          }

          // Fallback if validation results not available (shouldn't normally happen)
          cblcarsLog.warn('[RuntimeAPI.validate] No validation results found in model');
          return {
            success: true,
            message: 'Validation results not available (validation may not have run)',
            warning: 'Consider rebuilding configuration to get validation results'
          };        } catch (error) {
          cblcarsLog.error('[RuntimeAPI] Validation error:', error);
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: error.message,
              details: error
            }
          };
        }
      },

      // ==========================================
      // THEME MANAGEMENT
      // ==========================================

      theme: {
        /**
         * Apply a theme to the MSD card
         *
         * Activates a different theme for the MSD system. Theme switching
         * affects all overlays and components using theme tokens.
         *
         * @param {string} [cardId] - Card ID (optional, ignored in single-instance)
         * @param {string} themeName - Theme name/ID to apply
         * @returns {boolean} Success
         *
         * @example
         * // Apply theme (single-instance - cardId optional)
         * window.cblcars.msd.theme.apply('lcars-ds9');
         *
         * @example
         * // Future: specify card instance
         * window.cblcars.msd.theme.apply('my-card', 'lcars-voyager');
         */
        apply(cardId, themeName) {
          // Handle flexible arguments: apply(themeName) or apply(cardId, themeName)
          if (typeof cardId === 'string' && themeName === undefined) {
            themeName = cardId;
            cardId = null;
          }

          try {
            // Get theme manager from global namespace
            const themeManager = window.cblcars?.theme;

            if (!themeManager) {
              cblcarsLog.error('[RuntimeAPI] ThemeManager not available');
              return false;
            }

            if (!themeManager.initialized) {
              cblcarsLog.warn('[RuntimeAPI] ThemeManager not initialized');
              return false;
            }

            // Check if theme exists
            if (!themeManager.themes.has(themeName)) {
              cblcarsLog.error(`[RuntimeAPI] Theme not found: ${themeName}`);
              cblcarsLog.info('[RuntimeAPI] Available themes:', themeManager.listThemes());
              return false;
            }

            // Activate the theme
            // Note: In single-instance phase, this affects the entire MSD system
            // In multi-instance phase, we'd need to get the instance and activate theme per-instance
            themeManager.activateTheme(themeName);

            cblcarsLog.info(`[RuntimeAPI] ✅ Theme applied: ${themeName}`);
            return true;

          } catch (error) {
            cblcarsLog.error('[RuntimeAPI] Error applying theme:', error);
            return false;
          }
        },

        /**
         * Get current active theme
         *
         * Returns information about the currently active theme including
         * ID, name, description, and pack source.
         *
         * @param {string} [cardId] - Card ID (optional, ignored in single-instance)
         * @returns {Object|null} Current theme info or null if not available
         *
         * @example
         * const theme = window.cblcars.msd.theme.getCurrent();
         * console.log('Active theme:', theme.name);
         * console.log('Theme ID:', theme.id);
         * console.log('From pack:', theme.packId);
         */
        getCurrent(cardId = null) {
          try {
            const themeManager = window.cblcars?.theme;

            if (!themeManager) {
              cblcarsLog.warn('[RuntimeAPI] ThemeManager not available');
              return null;
            }

            if (!themeManager.initialized) {
              cblcarsLog.warn('[RuntimeAPI] ThemeManager not initialized');
              return null;
            }

            return themeManager.getActiveTheme();

          } catch (error) {
            cblcarsLog.error('[RuntimeAPI] Error getting current theme:', error);
            return null;
          }
        },

        /**
         * List available themes
         *
         * Returns an array of all available theme objects with their
         * metadata (ID, name, description, pack source).
         *
         * @returns {Array} Array of theme info objects
         *
         * @example
         * const themes = window.cblcars.msd.theme.list();
         * themes.forEach(theme => {
         *   console.log(`${theme.id}: ${theme.name} (from ${theme.packId})`);
         * });
         *
         * @example
         * // Get just the theme IDs
         * const themeIds = window.cblcars.msd.theme.list().map(t => t.id);
         * console.log('Available themes:', themeIds);
         */
        list() {
          try {
            const themeManager = window.cblcars?.theme;

            if (!themeManager) {
              cblcarsLog.warn('[RuntimeAPI] ThemeManager not available');
              return [];
            }

            if (!themeManager.initialized) {
              cblcarsLog.warn('[RuntimeAPI] ThemeManager not initialized');
              return [];
            }

            // Get all theme IDs and map to full info
            const themeIds = themeManager.listThemes();
            return themeIds.map(id => themeManager.getTheme(id)).filter(Boolean);

          } catch (error) {
            cblcarsLog.error('[RuntimeAPI] Error listing themes:', error);
            return [];
          }
        }
      },

      // ==========================================
      // OVERLAY OPERATIONS
      // ==========================================

      overlays: {
        /**
         * List all overlays
         *
         * Returns an array of overlay objects with basic information.
         * Each overlay includes id, type, position, and size.
         *
         * @param {string} [cardId] - Card ID (optional, ignored in Phase 0)
         * @returns {Array} Array of overlay objects
         *
         * @example
         * const overlays = window.cblcars.msd.overlays.list();
         * console.log(`Found ${overlays.length} overlays`);
         * overlays.forEach(ov => console.log(ov.id, ov.type));
         */
        list(cardId = null) {
          try {
            const instance = MsdRuntimeAPI.create().getInstance(cardId);
            if (!instance) return [];

            const model = instance.getResolvedModel?.();
            if (!model?.overlays) return [];

            // Return simplified overlay info (user-facing)
            return model.overlays.map(overlay => ({
              id: overlay.id,
              type: overlay.type,
              position: overlay.position || [0, 0],
              size: overlay.size || [100, 50]
            }));
          } catch (error) {
            cblcarsLog.error('[RuntimeAPI] Error listing overlays:', error);
            return [];
          }
        },

        /**
         * Show overlay (make visible)
         *
         * Future implementation will control overlay visibility.
         * Currently not implemented.
         *
         * @param {string} cardId - Card ID or overlay ID
         * @param {string} [overlayId] - Overlay ID
         * @returns {Object} NOT_IMPLEMENTED response
         *
         * @example
         * // Show specific overlay
         * window.cblcars.msd.overlays.show('overlay-1');
         */
        show(cardId, overlayId) {
          // Handle single-arg case: show(overlayId)
          if (typeof cardId === 'string' && overlayId === undefined) {
            overlayId = cardId;
            cardId = null;
          }

          cblcarsLog.warn('[RuntimeAPI] overlays.show() not yet implemented - planned for Phase 5');
          cblcarsLog.info('[RuntimeAPI] This will control overlay visibility dynamically');
          return {
            error: 'NOT_IMPLEMENTED',
            message: 'Feature planned for Phase 5',
            overlayId,
            plannedFeatures: [
              'Dynamically show/hide overlays',
              'Conditional overlay visibility',
              'Animation-driven visibility'
            ]
          };
        },

        /**
         * Hide overlay (make invisible)
         *
         * Future implementation will control overlay visibility.
         * Currently not implemented.
         *
         * @param {string} cardId - Card ID or overlay ID
         * @param {string} [overlayId] - Overlay ID
         * @returns {Object} NOT_IMPLEMENTED response
         *
         * @example
         * // Hide specific overlay
         * window.cblcars.msd.overlays.hide('overlay-1');
         */
        hide(cardId, overlayId) {
          // Handle single-arg case: hide(overlayId)
          if (typeof cardId === 'string' && overlayId === undefined) {
            overlayId = cardId;
            cardId = null;
          }

          cblcarsLog.warn('[RuntimeAPI] overlays.hide() not yet implemented - planned for Phase 5');
          cblcarsLog.info('[RuntimeAPI] This will control overlay visibility dynamically');
          return {
            error: 'NOT_IMPLEMENTED',
            message: 'Feature planned for Phase 5',
            overlayId,
            plannedFeatures: [
              'Dynamically show/hide overlays',
              'Conditional overlay visibility',
              'Animation-driven visibility'
            ]
          };
        },

        /**
         * Highlight overlay temporarily
         *
         * Temporarily highlights an overlay for debugging or user feedback.
         * Uses MsdIntrospection.highlight() if available.
         *
         * @param {string} cardId - Card ID or overlay ID
         * @param {string|number} [overlayId] - Overlay ID or duration
         * @param {number} [duration] - Duration in ms (default: 2000)
         * @returns {boolean} Success
         *
         * @example
         * // Highlight overlay for 2 seconds (default)
         * window.cblcars.msd.overlays.highlight('overlay-1');
         *
         * // Highlight for custom duration
         * window.cblcars.msd.overlays.highlight('overlay-1', 3000);
         */
        highlight(cardId, overlayId, duration = 2000) {
          // Handle argument variations:
          // highlight(overlayId) -> cardId=null, overlayId=overlayId, duration=2000
          // highlight(overlayId, duration) -> cardId=null, overlayId=overlayId, duration=duration
          // highlight(cardId, overlayId, duration) -> all params as-is

          if (typeof cardId === 'string' && typeof overlayId === 'number') {
            // highlight(overlayId, duration)
            duration = overlayId;
            overlayId = cardId;
            cardId = null;
          } else if (typeof cardId === 'string' && overlayId === undefined) {
            // highlight(overlayId)
            overlayId = cardId;
            cardId = null;
          }

          try {
            const instance = MsdRuntimeAPI.create().getInstance(cardId);

            // Get mount element from renderer
            const mountEl = instance?.renderer?.mountEl;

            if (!mountEl) {
              cblcarsLog.warn('[RuntimeAPI] Mount element not available for highlighting');
              return false;
            }

            // Check if MsdIntrospection.highlight is available
            if (typeof MsdIntrospection?.highlight === 'function') {
              MsdIntrospection.highlight([overlayId], { root: mountEl, duration });
              cblcarsLog.debug('[RuntimeAPI] Highlighted overlay:', overlayId, 'for', duration, 'ms');
              return true;
            }

            // Fallback if MsdIntrospection not available
            cblcarsLog.warn('[RuntimeAPI] MsdIntrospection.highlight not available');
            cblcarsLog.debug('[RuntimeAPI] Would highlight:', overlayId, 'for', duration, 'ms');
            return false;

          } catch (error) {
            cblcarsLog.error('[RuntimeAPI] Error highlighting overlay:', error);
            return false;
          }
        }
      },

      // ==========================================
      // ACTIONS & ANIMATIONS (Placeholder)
      // ==========================================

      /**
       * Trigger a defined action
       * @param {string} [cardId] - Card ID (optional)
       * @param {string} actionId - Action ID
       * @param {Object} [params] - Action parameters
       * @returns {Object} NOT_IMPLEMENTED response
       */
      trigger(cardId, actionId, params) {
        // Handle flexible arguments
        if (typeof cardId === 'string' && typeof actionId === 'string' && params === undefined) {
          // trigger(actionId, params) format
          params = actionId;
          actionId = cardId;
          cardId = null;
        }

        cblcarsLog.warn('[RuntimeAPI] trigger() not yet implemented - planned for Phase 5');
        cblcarsLog.info('[RuntimeAPI] This will enable programmatic action triggering');
        return {
          error: 'NOT_IMPLEMENTED',
          message: 'Feature planned for Phase 5',
          actionId,
          plannedFeatures: [
            'Programmatically trigger card actions',
            'Execute service calls from scripts',
            'Chain actions together'
          ]
        };
      },

      /**
       * Play an animation on an overlay
       *
       * @param {string} [cardId] - Card ID (optional, ignored in Phase 0)
       * @param {string} overlayId - Overlay identifier
       * @param {string} presetName - Animation preset name
       * @param {Object} [params] - Additional animation parameters
       * @returns {Object|null} Animation instance or error response
       *
       * @example
       * // Simple usage
       * window.cblcars.msd.animate('cpu_status', 'pulse');
       *
       * @example
       * // With parameters
       * window.cblcars.msd.animate('cpu_status', 'pulse', {
       *   duration: 500,
       *   color: 'var(--lcars-red)'
       * });
       *
       * @example
       * // With cardId (future multi-instance support)
       * window.cblcars.msd.animate('card-123', 'cpu_status', 'glow', { duration: 800 });
       */
      animate(cardId, overlayId, presetName, params = {}) {
        // Handle flexible arguments
        if (typeof cardId === 'string' && typeof overlayId === 'string' &&
            typeof presetName === 'string' && typeof params === 'object') {
          // animate(cardId, overlayId, presetName, params) - full form
        } else if (typeof cardId === 'string' && typeof overlayId === 'string' &&
                   (typeof presetName === 'object' || presetName === undefined)) {
          // animate(overlayId, presetName, params) - no cardId
          params = presetName || {};
          presetName = overlayId;
          overlayId = cardId;
          cardId = null;
        } else {
          cblcarsLog.error('[RuntimeAPI] animate() invalid arguments');
          return {
            error: 'INVALID_ARGUMENTS',
            message: 'Expected: animate(overlayId, preset, [params]) or animate(cardId, overlayId, preset, [params])'
          };
        }

        try {
          const instance = MsdRuntimeAPI.create().getInstance(cardId);
          if (!instance) {
            cblcarsLog.warn('[RuntimeAPI] animate() - No MSD instance available');
            return {
              error: 'NO_INSTANCE',
              message: 'MSD instance not available'
            };
          }

          const systemsManager = instance?.systemsManager;
          const animationManager = systemsManager?.animationManager;

          if (!animationManager) {
            cblcarsLog.warn('[RuntimeAPI] animate() - AnimationManager not available');
            return {
              error: 'NO_ANIMATION_MANAGER',
              message: 'Animation system not initialized'
            };
          }

          // Play animation
          const result = animationManager.playAnimation(overlayId, {
            preset: presetName,
            ...params,
            trigger_source: 'runtime_api'
          });

          if (result) {
            cblcarsLog.debug(`[RuntimeAPI] Animation triggered: ${overlayId} / ${presetName}`);
            return {
              success: true,
              overlayId,
              preset: presetName,
              params
            };
          } else {
            return {
              error: 'ANIMATION_FAILED',
              message: 'Failed to play animation',
              overlayId,
              preset: presetName
            };
          }
        } catch (error) {
          cblcarsLog.error('[RuntimeAPI] animate() error:', error);
          return {
            error: 'EXCEPTION',
            message: error.message
          };
        }
      },

      /**
       * Stop all animations on an overlay
       *
       * @param {string} [cardId] - Card ID (optional, ignored in Phase 0)
       * @param {string} overlayId - Overlay identifier
       * @returns {Object} Result object
       *
       * @example
       * window.cblcars.msd.stopAnimation('cpu_status');
       */
      stopAnimation(cardId, overlayId) {
        // Handle flexible arguments
        if (typeof cardId === 'string' && overlayId === undefined) {
          overlayId = cardId;
          cardId = null;
        }

        try {
          const instance = MsdRuntimeAPI.create().getInstance(cardId);
          if (!instance) {
            return { error: 'NO_INSTANCE', message: 'MSD instance not available' };
          }

          const animationManager = instance?.systemsManager?.animationManager;
          if (!animationManager) {
            return { error: 'NO_ANIMATION_MANAGER', message: 'Animation system not initialized' };
          }

          animationManager.stopAnimation(overlayId);

          cblcarsLog.debug(`[RuntimeAPI] Animation stopped: ${overlayId}`);
          return { success: true, overlayId };
        } catch (error) {
          cblcarsLog.error('[RuntimeAPI] stopAnimation() error:', error);
          return { error: 'EXCEPTION', message: error.message };
        }
      },

      /**
       * Pause animations on an overlay
       *
       * @param {string} [cardId] - Card ID (optional, ignored in Phase 0)
       * @param {string} overlayId - Overlay identifier
       * @returns {Object} Result object
       *
       * @example
       * window.cblcars.msd.pauseAnimation('cpu_status');
       */
      pauseAnimation(cardId, overlayId) {
        // Handle flexible arguments
        if (typeof cardId === 'string' && overlayId === undefined) {
          overlayId = cardId;
          cardId = null;
        }

        try {
          const instance = MsdRuntimeAPI.create().getInstance(cardId);
          if (!instance) {
            return { error: 'NO_INSTANCE', message: 'MSD instance not available' };
          }

          const animationManager = instance?.systemsManager?.animationManager;
          if (!animationManager) {
            return { error: 'NO_ANIMATION_MANAGER', message: 'Animation system not initialized' };
          }

          animationManager.pauseOverlay(overlayId);

          cblcarsLog.debug(`[RuntimeAPI] Animation paused: ${overlayId}`);
          return { success: true, overlayId };
        } catch (error) {
          cblcarsLog.error('[RuntimeAPI] pauseAnimation() error:', error);
          return { error: 'EXCEPTION', message: error.message };
        }
      },

      /**
       * Resume animations on an overlay
       *
       * @param {string} [cardId] - Card ID (optional, ignored in Phase 0)
       * @param {string} overlayId - Overlay identifier
       * @returns {Object} Result object
       *
       * @example
       * window.cblcars.msd.resumeAnimation('cpu_status');
       */
      resumeAnimation(cardId, overlayId) {
        // Handle flexible arguments
        if (typeof cardId === 'string' && overlayId === undefined) {
          overlayId = cardId;
          cardId = null;
        }

        try {
          const instance = MsdRuntimeAPI.create().getInstance(cardId);
          if (!instance) {
            return { error: 'NO_INSTANCE', message: 'MSD instance not available' };
          }

          const animationManager = instance?.systemsManager?.animationManager;
          if (!animationManager) {
            return { error: 'NO_ANIMATION_MANAGER', message: 'Animation system not initialized' };
          }

          animationManager.resumeOverlay(overlayId);

          cblcarsLog.debug(`[RuntimeAPI] Animation resumed: ${overlayId}`);
          return { success: true, overlayId };
        } catch (error) {
          cblcarsLog.error('[RuntimeAPI] resumeAnimation() error:', error);
          return { error: 'EXCEPTION', message: error.message };
        }
      }
    };
  }
}
