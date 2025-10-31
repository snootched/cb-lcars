/**
 * ApexChartsOverlay.js
 * Instance-based ApexCharts overlay with lifecycle management
 *
 * Phase 3B Step 6: Migration from static ApexChartsOverlayRenderer
 *
 * Architecture:
 * - Extends OverlayBase for lifecycle management
 * - Each instance manages one chart overlay
 * - Delegates actual chart rendering to ApexChartsOverlayRenderer (keeps complexity there)
 * - Handles positioning, subscriptions, and cleanup
 *
 * Note: Unlike other overlays, ApexCharts render as HTML divs layered over SVG,
 * so we keep the complex rendering logic in ApexChartsOverlayRenderer and just
 * provide the lifecycle wrapper here.
 *
 * Lifecycle:
 * 1. Constructor: Store overlay config
 * 2. initialize(mountEl): Pre-setup (minimal)
 * 3. render(): Delegate to ApexChartsOverlayRenderer
 * 4. update(): Update chart data
 * 5. destroy(): Cleanup chart instance
 */

import { OverlayBase } from './OverlayBase.js';
import { ApexChartsOverlayRenderer } from '../renderer/ApexChartsOverlayRenderer.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * ApexChartsOverlay - Instance-based ApexCharts overlay
 *
 * Features:
 * - ApexCharts integration with MSD positioning
 * - Data source subscriptions for live updates
 * - Chart templates support
 * - Multiple chart types (line, bar, area, pie, etc.)
 * - Responsive positioning
 * - Tooltip support
 */
export class ApexChartsOverlay extends OverlayBase {
  constructor(overlay, systemsManager) {
    super(overlay, systemsManager);

    // Store card instance for ApexChartsOverlayRenderer
    this.cardInstance = null;

    cblcarsLog.debug(`[ApexChartsOverlay] Created instance for overlay ${overlay.id}`);
  }

  /**
   * Initialize ApexCharts overlay
   * Minimal setup - most work happens in render()
   *
   * @param {Element} mountEl - Mount element for the overlay
   * @returns {Promise<void>}
   */
  async initialize(mountEl) {
    await super.initialize(mountEl);

    try {
      // Resolve card instance for ApexChartsOverlayRenderer
      this.cardInstance = this._resolveCardInstance();

      cblcarsLog.debug(`[ApexChartsOverlay] Initialized overlay ${this.overlay.id}:`, {
        hasCardInstance: !!this.cardInstance,
        chartType: this.overlay.chart_type,
        hasTemplate: !!this.overlay.template
      });
    } catch (error) {
      cblcarsLog.error(`[ApexChartsOverlay] Error initializing overlay ${this.overlay.id}:`, error);
      throw error;
    }
  }

  /**
   * Render ApexCharts overlay
   * Delegates to ApexChartsOverlayRenderer which handles the complex HTML/SVG layering
   *
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions [minX, minY, width, height]
   * @param {Element} svgContainer - SVG container element
   * @param {Object} cardInstance - Card instance for data source access
   * @returns {Object} {markup, actionInfo, overlayId, metadata, provenance}
   */
  render(overlay, anchors, viewBox, svgContainer, cardInstance) {
    // Use provided cardInstance or cached one
    const effectiveCardInstance = cardInstance || this.cardInstance;

    try {
      // Delegate to static renderer which handles all the complex chart logic
      const result = ApexChartsOverlayRenderer.render(
        overlay,
        anchors,
        viewBox,
        svgContainer,
        effectiveCardInstance
      );

      // ApexChartsOverlayRenderer returns { markup, provenance }
      // Normalize to our standard format
      return {
        markup: result.markup || '',
        actionInfo: null, // Charts don't have standard actions
        overlayId: overlay.id,
        metadata: {
          chartType: overlay.chart_type,
          hasTemplate: !!overlay.template,
          hasDataSource: !!(overlay.source || overlay.data_source || overlay.sources)
        },
        provenance: result.provenance || this._getRendererProvenance(overlay.id, {
          overlay_type: 'apexchart',
          chart_type: overlay.chart_type
        })
      };

    } catch (error) {
      cblcarsLog.error(`[ApexChartsOverlay] Rendering failed for overlay ${overlay.id}:`, error);
      return {
        markup: '',
        actionInfo: null,
        overlayId: overlay.id,
        metadata: { error: error.message },
        provenance: this._getRendererProvenance(overlay.id, {
          overlay_type: 'apexchart',
          error: error.message
        })
      };
    }
  }

  /**
   * Update ApexCharts overlay with new data
   * Delegates to ApexChartsOverlayRenderer.updateChartData
   *
   * @param {Element} overlayElement - The overlay's DOM element (not used for charts)
   * @param {Object} overlay - Updated overlay configuration
   * @param {*} sourceData - New data from data source
   * @returns {boolean} Success status
   */
  update(overlayElement, overlay, sourceData) {
    try {
      cblcarsLog.trace(`[ApexChartsOverlay] Updating overlay ${overlay.id} with data:`, sourceData);

      // Update cached overlay reference
      this.overlay = overlay;

      // Get data source manager
      const dataSourceManager = this.systemsManager?.dataSourceManager;

      if (!dataSourceManager) {
        cblcarsLog.warn(`[ApexChartsOverlay] No DataSourceManager available for update of ${overlay.id}`);
        return false;
      }

      // Delegate to static renderer's update method
      ApexChartsOverlayRenderer.updateChartData(overlay.id, overlay, dataSourceManager);

      return true;

    } catch (error) {
      cblcarsLog.error(`[ApexChartsOverlay] Error updating overlay ${overlay.id}:`, error);
      return false;
    }
  }

  /**
   * Destroy ApexCharts overlay
   * Cleanup chart instance and subscriptions
   */
  destroy() {
    cblcarsLog.debug(`[ApexChartsOverlay] Destroying overlay ${this.overlay.id}`);

    try {
      // Delegate to static renderer's destroy method
      ApexChartsOverlayRenderer.destroyChart(this.overlay.id);
    } catch (error) {
      cblcarsLog.error(`[ApexChartsOverlay] Error destroying chart ${this.overlay.id}:`, error);
    }

    // Clear references
    this.cardInstance = null;

    // Call parent destroy (handles DataSource cleanup if any)
    super.destroy();
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Resolve card instance for ApexChartsOverlayRenderer
   *
   * @private
   * @returns {Object|null} Card instance
   */
  _resolveCardInstance() {
    // Try various sources in priority order

    // 1. Pipeline instance
    const pipelineInstance = window.cblcars.debug.msd?.pipelineInstance;
    if (pipelineInstance?.cardInstance) {
      return pipelineInstance.cardInstance;
    }

    // 2. Global card instance
    if (window._msdCardInstance) {
      return window._msdCardInstance;
    }

    // 3. CB-LCARS card instance
    if (window.cb_lcars_card_instance) {
      return window.cb_lcars_card_instance;
    }

    // 4. SystemsManager
    if (this.systemsManager?.cardInstance) {
      return this.systemsManager.cardInstance;
    }

    cblcarsLog.warn(`[ApexChartsOverlay] Could not resolve card instance for ${this.overlay.id}`);
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
      renderer: 'ApexChartsOverlay',
      version: '3.0.0',
      timestamp: Date.now(),
      overlayId,
      metadata
    };
  }
}

// Expose to window for console debugging
if (typeof window !== 'undefined') {
  window.ApexChartsOverlay = ApexChartsOverlay;
}
