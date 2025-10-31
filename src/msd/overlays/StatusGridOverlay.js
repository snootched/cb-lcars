/**
 * StatusGridOverlay.js
 * Instance-based status grid overlay with lifecycle management
 *
 * Phase 3B Step 4: Migration from static StatusGridRenderer
 *
 * Architecture:
 * - Extends OverlayBase for lifecycle management
 * - Each instance manages one status grid overlay
 * - Delegates actual grid rendering to StatusGridRenderer (keeps complexity there)
 * - Handles positioning, cell updates, and cleanup
 *
 * Note: StatusGridRenderer is extremely complex (3312 lines) with:
 * - Unified style resolution system with token support
 * - Grid layout calculations (rows, columns, gaps)
 * - Cell configuration management
 * - Action processing for each cell
 * - Bracket rendering
 * - Status ranges
 *
 * Given this complexity, we use a wrapper pattern to provide lifecycle benefits
 * without major refactoring of the proven StatusGridRenderer logic.
 *
 * Lifecycle:
 * 1. Constructor: Store overlay config
 * 2. initialize(mountEl): Pre-setup (minimal)
 * 3. render(): Delegate to StatusGridRenderer
 * 4. update(): Update grid/cell data
 * 5. destroy(): Cleanup resources
 */

import { OverlayBase } from './OverlayBase.js';
import { StatusGridRenderer } from '../renderer/StatusGridRenderer.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * StatusGridOverlay - Instance-based status grid overlay
 *
 * Features:
 * - Grid of independent button cells
 * - Full CB-LCARS styling with inheritance
 * - Cell-level actions (tap, hold, double_tap)
 * - Data source integration per cell
 * - Status ranges with color mapping
 * - LCARS presets (button + text)
 * - Bracket rendering
 * - Template processing
 * - Effects (gradient, pattern, glow, shadow)
 */
export class StatusGridOverlay extends OverlayBase {
  constructor(overlay, systemsManager) {
    super(overlay, systemsManager);

    // Store card instance for action handling
    this.cardInstance = null;

    cblcarsLog.debug(`[StatusGridOverlay] Created instance for overlay ${overlay.id}`);
  }

  /**
   * Initialize status grid overlay
   * Minimal setup - most work happens in render()
   *
   * @param {Element} mountEl - Mount element for the overlay
   * @returns {Promise<void>}
   */
  async initialize(mountEl) {
    await super.initialize(mountEl);

    try {
      // Resolve card instance for action handling
      this.cardInstance = this._resolveCardInstance();

      cblcarsLog.debug(`[StatusGridOverlay] Initialized overlay ${this.overlay.id}:`, {
        hasCardInstance: !!this.cardInstance,
        cellCount: this.overlay.cells?.length || 0,
        hasPreset: !!(this.overlay.style?.lcars_button_preset)
      });
    } catch (error) {
      cblcarsLog.error(`[StatusGridOverlay] Error initializing overlay ${this.overlay.id}:`, error);
      throw error;
    }
  }

  /**
   * Render status grid overlay
   * Delegates to StatusGridRenderer which handles all the complex grid logic
   *
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions [minX, minY, width, height]
   * @param {Element} svgContainer - SVG container element
   * @param {Object} cardInstance - Card instance for action handling
   * @returns {Object} {markup, actionInfo, overlayId, metadata, provenance}
   */
  render(overlay, anchors, viewBox, svgContainer, cardInstance) {
    // Use provided cardInstance or cached one
    const effectiveCardInstance = cardInstance || this.cardInstance;

    try {
      // Delegate to static renderer which handles all the complex grid logic
      const result = StatusGridRenderer.render(
        overlay,
        anchors,
        viewBox,
        effectiveCardInstance
      );

      // StatusGridRenderer returns { markup, actionInfo, overlayId, provenance }
      // Already in the correct format
      return {
        markup: result.markup || '',
        actionInfo: result.actionInfo || null,
        overlayId: result.overlayId || overlay.id,
        metadata: {
          cellCount: overlay.cells?.length || 0,
          hasPreset: !!(overlay.style?.lcars_button_preset),
          gridRows: overlay.rows,
          gridColumns: overlay.columns
        },
        provenance: result.provenance || this._getRendererProvenance(overlay.id, {
          overlay_type: 'status_grid',
          cell_count: overlay.cells?.length || 0
        })
      };

    } catch (error) {
      cblcarsLog.error(`[StatusGridOverlay] Rendering failed for overlay ${overlay.id}:`, error);
      return {
        markup: '',
        actionInfo: null,
        overlayId: overlay.id,
        metadata: { error: error.message },
        provenance: this._getRendererProvenance(overlay.id, {
          overlay_type: 'status_grid',
          error: error.message
        })
      };
    }
  }

  /**
   * Update status grid overlay with new data
   * Delegates to StatusGridRenderer.updateGridData
   *
   * @param {Element} overlayElement - The overlay's DOM element (grid group element)
   * @param {Object} overlay - Updated overlay configuration
   * @param {*} sourceData - New data from data source
   * @returns {boolean} Success status
   */
  update(overlayElement, overlay, sourceData) {
    try {
      cblcarsLog.trace(`[StatusGridOverlay] Updating overlay ${overlay.id} with data:`, sourceData);

      // Update cached overlay reference
      this.overlay = overlay;

      // Delegate to static renderer's update method
      return StatusGridRenderer.updateGridData(overlayElement, overlay, sourceData);

    } catch (error) {
      cblcarsLog.error(`[StatusGridOverlay] Error updating overlay ${overlay.id}:`, error);
      return false;
    }
  }

  /**
   * Destroy status grid overlay
   * Cleanup resources (handled by OverlayBase for DataSource subscriptions)
   */
  destroy() {
    cblcarsLog.debug(`[StatusGridOverlay] Destroying overlay ${this.overlay.id}`);

    // Clear references
    this.cardInstance = null;

    // Call parent destroy (handles DataSource cleanup)
    super.destroy();
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Resolve card instance for action handling
   *
   * @private
   * @returns {Object|null} Card instance
   */
  _resolveCardInstance() {
    // Try various sources in priority order

    // 1. SystemsManager
    if (this.systemsManager?.cardInstance) {
      return this.systemsManager.cardInstance;
    }

    // 2. Pipeline instance
    const pipelineInstance = window.cblcars.debug.msd?.pipelineInstance;
    if (pipelineInstance?.cardInstance) {
      return pipelineInstance.cardInstance;
    }

    // 3. StatusGridRenderer's static method
    if (StatusGridRenderer._resolveCardInstance) {
      const resolved = StatusGridRenderer._resolveCardInstance();
      if (resolved) return resolved;
    }

    // 4. Global card instance
    if (window._msdCardInstance) {
      return window._msdCardInstance;
    }

    // 5. CB-LCARS card instance
    if (window.cb_lcars_card_instance) {
      return window.cb_lcars_card_instance;
    }

    cblcarsLog.warn(`[StatusGridOverlay] Could not resolve card instance for ${this.overlay.id}`);
    return null;
  }

  /**
   * Get renderer provenance information
   *
   * @private
   * @param {string} overlayId - Overlay ID
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Provenance information
   */
  _getRendererProvenance(overlayId, metadata = {}) {
    return {
      renderer: 'StatusGridOverlay',
      version: '3.0.0',
      timestamp: Date.now(),
      overlayId,
      metadata
    };
  }
}

// Expose to window for console debugging
if (typeof window !== 'undefined') {
  window.StatusGridOverlay = StatusGridOverlay;
}
