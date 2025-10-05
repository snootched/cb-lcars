import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { initMsdPipeline } from './PipelineCore.js';

/**
 * MSD Instance Manager - Provides single-instance protection for MSD system
 *
 * The MSD system is designed for single-instance operation due to:
 * - Global window references (window.__msdDebug, window.cblcars.msd.api)
 * - Singleton HUD Manager attached to document.body
 * - Shared resource managers with no namespace isolation
 * - Global card instance storage
 *
 * This manager ensures only one MSD instance is active per window and provides
 * graceful handling of conflicts with clear user feedback.
 */
export class MsdInstanceManager {
  static _currentInstance = null;
  static _currentMountElement = null;
  static _isInitializing = false;
  static _initializationPromise = null;

  /**
   * Request MSD instance initialization with single-instance protection
   * @param {Object} userMsdConfig - MSD configuration
   * @param {HTMLElement} mountEl - Mount element
   * @param {Object} hass - Home Assistant instance
   * @param {boolean} isPreview - Whether this is a preview render
   * @returns {Promise<Object>} Pipeline API or preview/blocked content
   */
  static async requestInstance(userMsdConfig, mountEl, hass, isPreview = false) {
    cblcarsLog.debug('[MsdInstanceManager] 🚀 requestInstance called:', {
      hasExistingInstance: !!MsdInstanceManager._currentInstance,
      isInitializing: MsdInstanceManager._isInitializing,
      isPreview,
      mountElTag: mountEl?.tagName,
      timestamp: new Date().toISOString()
    });

    // Handle preview mode specially
    if (isPreview) {
      cblcarsLog.debug('[MsdInstanceManager] 🔍 Preview mode detected - returning preview content');
      return MsdInstanceManager._createPreviewContent(userMsdConfig, mountEl);
    }

    // Handle race condition: if we're already initializing, wait for completion
    if (MsdInstanceManager._isInitializing && MsdInstanceManager._initializationPromise) {
      cblcarsLog.debug('[MsdInstanceManager] ⏳ Instance initialization in progress, waiting...');
      try {
        const existingInstance = await MsdInstanceManager._initializationPromise;
        if (existingInstance && MsdInstanceManager._currentMountElement === mountEl) {
          cblcarsLog.debug('[MsdInstanceManager] ✅ Returning completed initialization for same mount');
          return existingInstance;
        }
      } catch (error) {
        cblcarsLog.warn('[MsdInstanceManager] ⚠️ Previous initialization failed, proceeding with new attempt');
      }
    }

    // Check if instance already exists
    if (MsdInstanceManager._currentInstance) {
      const existingMount = MsdInstanceManager._currentMountElement;

      cblcarsLog.warn('[MsdInstanceManager] 🚨 MSD instance already exists:', {
        existingMount: existingMount?.tagName,
        requestedMount: mountEl?.tagName,
        sameMount: existingMount === mountEl
      });

      // If same mount element, return existing instance
      if (existingMount === mountEl) {
        cblcarsLog.debug('[MsdInstanceManager] ✅ Returning existing instance for same mount');
        return MsdInstanceManager._currentInstance;
      }

      // Different mount element - this is likely a view change or edit mode
      cblcarsLog.warn('[MsdInstanceManager] ⚠️ Blocking new MSD instance - only one allowed per window');
      cblcarsLog.warn('[MsdInstanceManager] 💡 Call destroyInstance() first if you need to reinitialize');

      // Return a disabled pipeline that explains the situation
      return {
        enabled: false,
        blocked: true,
        reason: 'Another MSD instance is already active',
        existingMount: existingMount?.tagName,
        requestedMount: mountEl?.tagName,
        html: MsdInstanceManager._createBlockedContent(existingMount, mountEl),
        destroyExisting: () => MsdInstanceManager.destroyInstance(),
        getExistingInstance: () => MsdInstanceManager._currentInstance
      };
    }

    // No existing instance - create new one
    MsdInstanceManager._isInitializing = true;
    MsdInstanceManager._initializationPromise = MsdInstanceManager._performInitialization(userMsdConfig, mountEl, hass);

    try {
      const pipelineApi = await MsdInstanceManager._initializationPromise;
      return pipelineApi;
    } catch (error) {
      cblcarsLog.error('[MsdInstanceManager] ❌ Failed to create MSD instance:', error);
      throw error;
    } finally {
      MsdInstanceManager._isInitializing = false;
      MsdInstanceManager._initializationPromise = null;
    }
  }

  /**
   * Perform the actual initialization
   * @private
   */
  static async _performInitialization(userMsdConfig, mountEl, hass) {
    try {
      cblcarsLog.debug('[MsdInstanceManager] 🔧 Starting MSD pipeline initialization');

      const pipelineApi = await initMsdPipeline(userMsdConfig, mountEl, hass);

      // Store instance references
      MsdInstanceManager._currentInstance = pipelineApi;
      MsdInstanceManager._currentMountElement = mountEl;

      // Enhanced cleanup on instance
      const originalDestroy = pipelineApi.destroy || (() => {});
      pipelineApi.destroy = () => {
        originalDestroy.call(pipelineApi);
        MsdInstanceManager.destroyInstance();
      };

      // ADD BACK: setCardInstance call for StatusGridRenderer compatibility
      if (pipelineApi.setCardInstance && typeof pipelineApi.setCardInstance === 'function') {
        const cardInstance = window.cb_lcars_card_instance || window._currentCardInstance;
        if (cardInstance) {
          cblcarsLog.debug('[MsdInstanceManager] 🔧 Setting card instance via pipeline setCardInstance');
          pipelineApi.setCardInstance(cardInstance);
        }
      }

      cblcarsLog.debug('[MsdInstanceManager] ✅ New MSD instance created and registered');
      return pipelineApi;

    } catch (error) {
      cblcarsLog.error('[MsdInstanceManager] ❌ Pipeline initialization failed:', error);
      throw error;
    }
  }

  /**
   * Detect if we're in preview mode
   * @param {HTMLElement} mountEl - Mount element to check context
   * @returns {boolean} True if in preview mode
   */
  static detectPreviewMode(mountEl) {
    // Check various indicators of preview mode
    const indicators = [
      // Direct preview property (if card has it)
      mountEl?.closest?.('[preview]'),

      // Home Assistant card preview element
      mountEl?.closest?.('hui-card-preview'),

      // Check for edit mode indicators
      document.querySelector('hui-panel-mode'),

      // URL hash indicators
      window.location.hash.includes('edit=1'),

      // Check if parent has preview class
      mountEl?.closest?.('.preview'),

      // Check for card editor context
      mountEl?.closest?.('hui-card-element-editor'),

      // Check for lovelace edit mode
      document.querySelector('hui-root')?.shadowRoot?.querySelector('[edit-mode]')
    ];

    const isPreview = indicators.some(indicator => !!indicator);

    cblcarsLog.debug('[MsdInstanceManager] 🔍 Preview mode detection:', {
      isPreview,
      indicators: indicators.map((indicator, index) => ({ index, detected: !!indicator }))
    });

    return isPreview;
  }

  /**
   * Destroy current MSD instance and clean up all resources
   */
  static async destroyInstance() {
    if (!MsdInstanceManager._currentInstance) {
      cblcarsLog.debug('[MsdInstanceManager] No active instance to destroy');
      return;
    }

    cblcarsLog.debug('[MsdInstanceManager] 🧹 Destroying MSD instance...');

    try {
      // Call existing cleanup methods
      const instance = MsdInstanceManager._currentInstance;

      if (instance.systemsManager?.destroy) {
        await instance.systemsManager.destroy();
      }

      // Clear global references
      if (typeof window !== 'undefined') {
        delete window.__msdDebug?.pipelineInstance;
        delete window.__msdDebug?.systemsManager;
        delete window.__msdDebug?.routing;
        delete window.__msdDebug?.hud;

        // Clear card instance references
        delete window.cb_lcars_card_instance;
        delete window._currentCardInstance;
        delete window._msdCardInstance;

        // Clear HUD references
        delete window.__msdHudBus;
        delete window.__msdHudPanelControls;

        // Clear debug references
        delete window.__msdDebug?.cardInstance;
        delete window.__msdDebug?.debugManager;
      }

      // Clear instance references
      MsdInstanceManager._currentInstance = null;
      MsdInstanceManager._currentMountElement = null;

      cblcarsLog.debug('[MsdInstanceManager] ✅ MSD instance destroyed and references cleared');

    } catch (error) {
      cblcarsLog.error('[MsdInstanceManager] ❌ Error during instance destruction:', error);
    }
  }

  /**
   * Get current active instance (if any)
   */
  static getCurrentInstance() {
    return MsdInstanceManager._currentInstance;
  }

  /**
   * Check if an instance is currently active
   */
  static hasActiveInstance() {
    return !!MsdInstanceManager._currentInstance;
  }

  /**
   * Force replace current instance (for development/debugging)
   */
  static async forceReplace(userMsdConfig, mountEl, hass) {
    cblcarsLog.warn('[MsdInstanceManager] 🔄 Force replacing MSD instance');
    await MsdInstanceManager.destroyInstance();
    return MsdInstanceManager.requestInstance(userMsdConfig, mountEl, hass);
  }

  /**
   * Create preview content for Home Assistant editor
   * @private
   */
  static _createPreviewContent(userMsdConfig, mountEl) {
    const msdConfig = userMsdConfig?.msd || {};
    const baseSvg = msdConfig.base_svg?.source || 'ncc-1701-a-blue';
    const overlayCount = (msdConfig.overlays || []).length;
    const dataSourceCount = Object.keys(msdConfig.data_sources || {}).length;
    const rulesCount = (msdConfig.rules || []).length;

    return {
      enabled: true,
      preview: true,
      html: `
        <div style="
          width: 100%;
          height: 300px;
          background: linear-gradient(135deg, #001122 0%, #000611 100%);
          border: 2px solid var(--lcars-cyan, #00ffff);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--lcars-cyan, #00ffff);
          font-family: 'Antonio', monospace;
          position: relative;
          overflow: hidden;
        ">
          <!-- Background pattern -->
          <div style="
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image:
              radial-gradient(circle at 20% 20%, rgba(0,255,255,0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(255,170,0,0.1) 0%, transparent 50%);
            z-index: 0;
          "></div>

          <!-- Content -->
          <div style="z-index: 1; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; margin-bottom: 16px; color: var(--lcars-orange, #ff9900);">
              CB-LCARS MSD Preview
            </div>

            <div style="font-size: 14px; margin-bottom: 12px;">
              Master Systems Display Configuration
            </div>

            <div style="
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin: 20px 0;
              font-size: 12px;
              color: var(--lcars-white, #ffffff);
            ">
              <div style="text-align: right;">
                <div>Base SVG:</div>
                <div>Overlays:</div>
                <div>Data Sources:</div>
                <div>Rules:</div>
              </div>
              <div style="text-align: left; color: var(--lcars-yellow, #ffcc00);">
                <div>${baseSvg}</div>
                <div>${overlayCount}</div>
                <div>${dataSourceCount}</div>
                <div>${rulesCount}</div>
              </div>
            </div>

            <div style="
              font-size: 11px;
              opacity: 0.8;
              margin-top: 20px;
              padding: 8px;
              background: rgba(0,0,0,0.3);
              border-radius: 4px;
              border-left: 3px solid var(--lcars-orange, #ff9900);
            ">
              Preview Mode: Full MSD functionality available when dashboard is not in edit mode
            </div>
          </div>

          <!-- Corner accents -->
          <div style="
            position: absolute;
            top: 10px;
            right: 10px;
            width: 40px;
            height: 40px;
            border-top: 3px solid var(--lcars-orange, #ff9900);
            border-right: 3px solid var(--lcars-orange, #ff9900);
            border-radius: 0 8px 0 0;
          "></div>
          <div style="
            position: absolute;
            bottom: 10px;
            left: 10px;
            width: 40px;
            height: 40px;
            border-bottom: 3px solid var(--lcars-cyan, #00ffff);
            border-left: 3px solid var(--lcars-cyan, #00ffff);
            border-radius: 0 0 0 8px;
          "></div>
        </div>
      `
    };
  }

  /**
   * Create blocked instance content
   * @private
   */
  static _createBlockedContent(existingMount, requestedMount) {
    return `
      <div style="
        width: 100%;
        height: 200px;
        background: linear-gradient(135deg, #220011 0%, #110006 100%);
        border: 2px solid var(--lcars-red, #ff0000);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--lcars-red, #ff0000);
        font-family: 'Antonio', monospace;
        text-align: center;
        padding: 20px;
      ">
        <div style="font-size: 20px; font-weight: bold; margin-bottom: 16px;">
          ⚠️ MSD Instance Conflict
        </div>

        <div style="font-size: 14px; margin-bottom: 12px; color: var(--lcars-white, #ffffff);">
          Another MSD instance is already active
        </div>

        <div style="font-size: 12px; opacity: 0.8; margin-bottom: 16px;">
          Active: ${existingMount} | Requested: ${requestedMount}
        </div>

        <button onclick="window.__msdForceReplace?.()" style="
          background: var(--lcars-orange, #ff9900);
          color: black;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          font-family: inherit;
          font-size: 12px;
          cursor: pointer;
          font-weight: bold;
        ">
          FORCE REPLACE
        </button>

        <div style="font-size: 10px; margin-top: 12px; opacity: 0.6;">
          Only one MSD instance allowed per window
        </div>
      </div>
    `;
  }
}

// Set up global debugging helpers
if (typeof window !== 'undefined') {
  window.__msdForceReplace = async () => {
    const currentInstance = MsdInstanceManager.getCurrentInstance();
    const currentMount = MsdInstanceManager._currentMountElement;

    if (currentInstance && currentMount) {
      cblcarsLog.warn('[MsdInstanceManager] 🔄 Force replace triggered from global helper');
      await MsdInstanceManager.destroyInstance();

      // Try to get the card instance to trigger a re-render
      const cardInstance = window.cb_lcars_card_instance || window._currentCardInstance;
      if (cardInstance && typeof cardInstance.requestUpdate === 'function') {
        cardInstance.requestUpdate();
      }
    } else {
      cblcarsLog.debug('[MsdInstanceManager] 📊 No active instance to force replace');
    }
  };

  window.__msdStatus = () => {
    const status = {
      'Has Active Instance': MsdInstanceManager.hasActiveInstance(),
      'Current Mount': MsdInstanceManager._currentMountElement?.tagName || 'none',
      'Instance Enabled': MsdInstanceManager._currentInstance?.enabled || false,
      'Is Initializing': MsdInstanceManager._isInitializing,
      'Timestamp': new Date().toISOString()
    };

    console.table(status);
    return status;
  };
}