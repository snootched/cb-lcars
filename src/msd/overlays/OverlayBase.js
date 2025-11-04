/**
 * OverlayBase - Base class for all MSD overlay renderers
 *
 * Provides instance-based lifecycle management for overlays:
 * - initialize: Setup subscriptions, animation scopes
 * - render: Generate SVG markup
 * - update: Incremental DOM updates (no full re-render)
 * - computeAttachmentPoints: For line anchoring
 * - destroy: Cleanup resources
 *
 * Extends BaseRenderer to inherit:
 * - Theme management
 * - Style resolution
 * - Default value handling
 * - Provenance tracking
 *
 * Phase 3: Instance-based Overlay Runtime API
 *
 * @module msd/overlays/OverlayBase
 */

import { BaseRenderer } from '../renderer/BaseRenderer.js';
import { TemplateProcessor } from '../utils/TemplateProcessor.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { isHAEntity } from '../utils/HADomains.js';

/**
 * Base class for all overlay instances
 * @extends BaseRenderer
 */
export class OverlayBase extends BaseRenderer {
  /**
   * Create an overlay instance
   *
   * @param {Object} overlay - Overlay configuration
   * @param {Object} systemsManager - Reference to SystemsManager for accessing subsystems
   */
  constructor(overlay, systemsManager) {
    super();

    // Set renderer name for logging
    this.rendererName = this.constructor.name || 'OverlayBase';

    // Core properties
    this.overlay = overlay;
    this.systems = systemsManager;
    this.element = null;
    this.mountEl = null;

    // Lifecycle state
    this._initialized = false;
    this._destroyed = false;

    // Resource management
    this._subscriptions = [];
    this._animationScope = null;
    this._timers = [];

    // Performance tracking
    this._stats = {
      renderCount: 0,
      updateCount: 0,
      lastRender: null,
      lastUpdate: null
    };

    cblcarsLog.debug(`[${this.rendererName}] Instance created for overlay:`, overlay.id);
  }

  /**
   * Initialize overlay instance
   * Called once when overlay is first created
   *
   * Sets up:
   * - DataSource subscriptions
   * - Animation scopes
   * - Event listeners
   *
   * @param {Element} mountEl - Mount element (shadowRoot or container)
   * @returns {Promise<void>}
   */
  async initialize(mountEl) {
    if (this._initialized) {
      cblcarsLog.warn(`[${this.rendererName}] Already initialized:`, this.overlay.id);
      return;
    }

    this.mountEl = mountEl;

    cblcarsLog.debug(`[${this.rendererName}] Initializing overlay:`, this.overlay.id);

    try {
      // Get explicit update triggers from overlay config
      const updateTriggers = this._getUpdateTriggers();

      if (updateTriggers.length > 0) {
        cblcarsLog.debug(`[${this.rendererName}] Subscribing to update triggers:`, updateTriggers);

        // Subscribe to each trigger (HA entity or MSD datasource)
        for (const triggerRef of updateTriggers) {
          if (isHAEntity(triggerRef)) {
            this._subscribeToEntity(triggerRef);
          } else {
            this._subscribeToDataSource(triggerRef);
          }
        }
      } else {
        cblcarsLog.debug(`[${this.rendererName}] No triggers_update specified for overlay:`, this.overlay.id);
      }

      // Create animation scope if overlay has animations
      if (this.overlay.animations || this.overlay.animate) {
        this._createAnimationScope();
      }

      this._initialized = true;
      cblcarsLog.debug(`[${this.rendererName}] Initialization complete:`, this.overlay.id);

    } catch (error) {
      cblcarsLog.error(`[${this.rendererName}] Initialization failed:`, error);
      throw error;
    }
  }

  /**
   * Render overlay (returns markup string)
   *
   * Must be implemented by subclasses
   *
   * @abstract
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Available anchors
   * @param {Array} viewBox - ViewBox dimensions [x, y, width, height]
   * @param {Element} svgContainer - SVG container element
   * @param {Object} cardInstance - Card instance for actions
   * @returns {string} SVG markup
   * @throws {Error} If not implemented by subclass
   */
  render(overlay, anchors, viewBox, svgContainer, cardInstance = null) {
    throw new Error(`${this.rendererName}.render() must be implemented by subclass`);
  }

  /**
   * Update overlay when data changes
   *
   * Performs incremental DOM updates without full re-render
   * Must be implemented by subclasses
   *
   * @abstract
   * @param {Element} overlayElement - DOM element to update
   * @param {Object} overlay - Updated overlay config
   * @param {Object} sourceData - Changed data
   * @returns {boolean} True if DOM was updated
   * @throws {Error} If not implemented by subclass
   */
  update(overlayElement, overlay, sourceData) {
    throw new Error(`${this.rendererName}.update() must be implemented by subclass`);
  }

  /**
   * Compute attachment points for line anchoring
   *
   * Override in subclasses that support line attachment
   *
   * @param {Object} overlay - Overlay config
   * @param {Object} anchors - Available anchors
   * @param {Element} container - Container element
   * @param {Array} viewBox - ViewBox dimensions
   * @returns {Object|null} Attachment points or null
   */
  computeAttachmentPoints(overlay, anchors, container, viewBox) {
    // Default: no attachment points
    return null;
  }

  /**
   * Cleanup overlay resources
   *
   * Cleans up:
   * - DataSource subscriptions
   * - Animation scopes
   * - Timers
   * - Event listeners
   */
  destroy() {
    if (this._destroyed) {
      cblcarsLog.warn(`[${this.rendererName}] Already destroyed:`, this.overlay.id);
      return;
    }

    cblcarsLog.debug(`[${this.rendererName}] Destroying overlay:`, this.overlay.id);

    // Cleanup subscriptions
    this._cleanupSubscriptions();

    // Cleanup animations
    this._cleanupAnimations();

    // Cleanup timers
    this._cleanupTimers();

    // Clear element reference
    this.element = null;
    this.mountEl = null;

    this._destroyed = true;

    cblcarsLog.debug(`[${this.rendererName}] Destruction complete:`, this.overlay.id);
  }

  // ============================================================
  // Protected Methods (for subclass use)
  // ============================================================

  /**
   * Handle DataSource updates
   * @protected
   */
  _onDataUpdate(sourceId, data) {
    if (this._destroyed) {
      return;
    }

    cblcarsLog.debug(`[${this.rendererName}] DataSource update:`, sourceId, data);

    // Find DOM element if not cached
    if (!this.element && this.mountEl) {
      this.element = this.mountEl.querySelector(`#${this.overlay.id}`);
    }

    if (this.element) {
      try {
        const updated = this.update(this.element, this.overlay, data);

        if (updated) {
          this._stats.updateCount++;
          this._stats.lastUpdate = Date.now();
        }

      } catch (error) {
        cblcarsLog.error(`[${this.rendererName}] Update failed:`, error);
      }
    }
  }

  /**
   * Get explicit update triggers from overlay configuration
   * @protected
   * @returns {Array<string>} Array of trigger references (HA entities or MSD datasources)
   */
  _getUpdateTriggers() {
    if (!this.overlay.triggers_update || !Array.isArray(this.overlay.triggers_update)) {
      return [];
    }

    return this.overlay.triggers_update;
  }

  /**
   * Subscribe to Home Assistant entity updates
   * @protected
   * @param {string} entityId - Entity ID (e.g., 'sensor.temperature')
   */
  _subscribeToEntity(entityId) {
    // TODO: Implement HA entity subscription
    // This would integrate with MsdTemplateEngine or Home Assistant connection
    cblcarsLog.debug(`[${this.rendererName}] HA entity subscription requested:`, entityId);
    cblcarsLog.warn(`[${this.rendererName}] HA entity subscriptions not yet implemented - ${entityId} will not auto-update`);

    // Note: For now, HA entity updates are handled by MsdTemplateEngine separately
    // Full integration would require connecting to HA's WebSocket API
  }

  /**
   * Subscribe to DataSource updates
   * @protected
   */
  _subscribeToDataSource(sourceId) {
    if (!this.systems || !this.systems.dataSourceManager) {
      cblcarsLog.warn(`[${this.rendererName}] DataSourceManager not available, cannot subscribe`);
      return;
    }

    try {
      const unsubscribe = this.systems.dataSourceManager.subscribe(
        sourceId,
        this._onDataUpdate.bind(this, sourceId)
      );

      if (unsubscribe) {
        this._registerSubscription(unsubscribe);
        cblcarsLog.debug(`[${this.rendererName}] Subscribed to DataSource:`, sourceId);
      }

    } catch (error) {
      cblcarsLog.warn(`[${this.rendererName}] Failed to subscribe to ${sourceId}:`, error);
    }
  }

  /**
   * Register subscription for cleanup
   * @protected
   */
  _registerSubscription(unsubscribe) {
    if (typeof unsubscribe === 'function') {
      this._subscriptions.push(unsubscribe);
    }
  }

  /**
   * Register timer for cleanup
   * @protected
   */
  _registerTimer(timerId) {
    this._timers.push(timerId);
  }

  /**
   * Create animation scope
   * @protected
   */
  _createAnimationScope() {
    // Check if anime.js is available
    if (typeof window !== 'undefined' && window.cblcars && window.cblcars.anim) {
      try {
        this._animationScope = window.cblcars.anim.createScope();
        cblcarsLog.debug(`[${this.rendererName}] Animation scope created`);
      } catch (error) {
        cblcarsLog.warn(`[${this.rendererName}] Failed to create animation scope:`, error);
      }
    }
  }

  /**
   * Cleanup all subscriptions
   * @protected
   */
  _cleanupSubscriptions() {
    if (this._subscriptions.length > 0) {
      cblcarsLog.debug(`[${this.rendererName}] Cleaning up ${this._subscriptions.length} subscriptions`);

      this._subscriptions.forEach(unsub => {
        try {
          unsub();
        } catch (error) {
          cblcarsLog.warn(`[${this.rendererName}] Subscription cleanup error:`, error);
        }
      });

      this._subscriptions = [];
    }
  }

  /**
   * Cleanup animations
   * @protected
   */
  _cleanupAnimations() {
    if (this._animationScope) {
      try {
        if (typeof this._animationScope.destroy === 'function') {
          this._animationScope.destroy();
        }
        cblcarsLog.debug(`[${this.rendererName}] Animation scope destroyed`);
      } catch (error) {
        cblcarsLog.warn(`[${this.rendererName}] Animation cleanup error:`, error);
      }

      this._animationScope = null;
    }
  }

  /**
   * Cleanup timers
   * @protected
   */
  _cleanupTimers() {
    if (this._timers.length > 0) {
      cblcarsLog.debug(`[${this.rendererName}] Cleaning up ${this._timers.length} timers`);

      this._timers.forEach(timerId => {
        try {
          clearTimeout(timerId);
          clearInterval(timerId);
        } catch (error) {
          cblcarsLog.warn(`[${this.rendererName}] Timer cleanup error:`, error);
        }
      });

      this._timers = [];
    }
  }

  /**
   * Get overlay statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this._stats,
      initialized: this._initialized,
      destroyed: this._destroyed,
      subscriptions: this._subscriptions.length,
      timers: this._timers.length,
      hasAnimationScope: !!this._animationScope
    };
  }

  /**
   * Get the default animation target for this overlay type
   * Subclasses should override to provide smart defaults
   *
   * Examples:
   * - TextOverlay: Returns the <text> element (not the wrapper)
   * - ButtonOverlay: Returns the entire button group
   * - LineOverlay: Returns the <line> or <path> element
   *
   * @returns {Element} The element to animate by default
   */
  getDefaultAnimationTarget() {
    // Base implementation: return the root element
    return this.element;
  }

  /**
   * Get a specific animation target within this overlay
   *
   * Supports:
   * - 'overlay' or 'self' - The root overlay element
   * - 'label', 'content', etc. - Named sub-elements (overlay-specific)
   * - 'texts[n]' - Array index syntax (overlay-specific)
   * - CSS selector - Any valid selector (queried within overlay)
   *
   * @param {string} targetSpec - Target specification
   * @returns {Element|null} The target element or null if not found
   */
  getAnimationTarget(targetSpec) {
    // No spec or explicit self-reference = root element
    if (!targetSpec || targetSpec === 'overlay' || targetSpec === 'self') {
      return this.element;
    }

    // Try CSS selector within this overlay's element
    if (this.element) {
      try {
        return this.element.querySelector(targetSpec);
      } catch (error) {
        cblcarsLog.warn(
          `[${this.rendererName}] Invalid target selector "${targetSpec}":`,
          error
        );
        return null;
      }
    }

    return null;
  }
}

// Export for use by overlay subclasses
export default OverlayBase;
