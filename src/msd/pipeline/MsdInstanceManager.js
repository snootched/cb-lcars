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

      // Check if this is a preview mode request (different handling)
      const requestIsPreview = MsdInstanceManager.detectPreviewMode(mountEl);

      cblcarsLog.warn('[MsdInstanceManager] 🚨 MSD instance already exists:', {
        existingMount: existingMount?.tagName,
        requestedMount: mountEl?.tagName,
        sameMount: existingMount === mountEl,
        requestIsPreview: requestIsPreview
      });

      // If same mount element, return existing instance
      if (existingMount === mountEl) {
        cblcarsLog.debug('[MsdInstanceManager] ✅ Returning existing instance for same mount');
        return MsdInstanceManager._currentInstance;
      }

      // If this is a preview request, return preview content instead of blocking
      if (requestIsPreview) {
        cblcarsLog.debug('[MsdInstanceManager] 🔍 Request is in preview mode - returning preview content instead of blocking');
        return MsdInstanceManager._createPreviewContent(userMsdConfig, mountEl);
      }

      // Different mount element and not preview - this is a real conflict
      cblcarsLog.warn('[MsdInstanceManager] ⚠️ Blocking new MSD instance - only one allowed per window');
      cblcarsLog.warn('[MsdInstanceManager] 💡 Call destroyInstance() first if you need to reinitialize');

      // Return a disabled pipeline that explains the situation
      return {
        enabled: false,
        blocked: true,
        reason: 'Another MSD instance is already active',
        existingMount: MsdInstanceManager._getMountInfo(existingMount),
        requestedMount: MsdInstanceManager._getMountInfo(mountEl),
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
    // Get the card element that contains this mount (traverse up through shadow DOM)
    const cardElement = MsdInstanceManager._findCardElement(mountEl);

    // Extended traversal up the DOM tree to find preview indicators
    const extendedPath = MsdInstanceManager._getExtendedElementPath(cardElement, 10);

    // Check various indicators of preview mode from both mount and card level
    const indicators = [
      // PRIORITY 1: Reliable card editor/preview indicators
      { name: 'element-preview-div', detected: MsdInstanceManager._checkInPath(cardElement, '.element-preview', 15) },
      { name: 'element-editor-context', detected: MsdInstanceManager._checkInPath(cardElement, '.element-editor', 15) },

      // PRIORITY 2: Additional card editor indicators (for robustness)
      { name: 'ha-card-editor', detected: !!document.querySelector('ha-card-editor') },
      { name: 'hui-dialog-edit-card', detected: !!document.querySelector('hui-dialog-edit-card') },
      { name: 'card-editor', detected: !!(mountEl?.closest?.('hui-card-element-editor') || cardElement?.closest?.('hui-card-element-editor')) },
      { name: 'hui-card-preview', detected: !!(mountEl?.closest?.('hui-card-preview') || cardElement?.closest?.('hui-card-preview')) },

      // PRIORITY 3: Fallback indicators (only used if primary indicators fail)
      { name: 'url-config-path', detected: window.location.pathname.includes('/config/'), priority: 'fallback' },
      { name: 'ui-editor', detected: !!document.querySelector('hui-card-options, hui-entity-picker-table, ha-yaml-editor'), priority: 'fallback' },

      // DEPRIORITIZED: General edit mode indicators (for debugging only)
      { name: 'hui-card-edit-mode', detected: MsdInstanceManager._checkInPath(cardElement, 'hui-card-edit-mode', 5), priority: 'debug' },
      { name: 'ha-sortable-parent', detected: MsdInstanceManager._checkInPath(cardElement, 'ha-sortable', 15), priority: 'debug' },
      { name: 'hui-grid-section-pattern', detected: MsdInstanceManager._checkInPath(cardElement, 'hui-grid-section', 15), priority: 'debug' }
    ];    // Determine if we're in preview mode
    const primaryIndicators = indicators.filter(i => i.detected && !i.priority);
    const fallbackIndicators = indicators.filter(i => i.detected && i.priority === 'fallback');
    const debugIndicators = indicators.filter(i => i.detected && i.priority === 'debug');

    // Preview mode if we have primary indicators, or fallback indicators when no primary ones exist
    const isPreview = primaryIndicators.length > 0 || (primaryIndicators.length === 0 && fallbackIndicators.length > 0);

    cblcarsLog.debug('[MsdInstanceManager] 🔍 Preview mode detection:', {
      isPreview,
      primaryIndicators: primaryIndicators.map(i => i.name),
      fallbackIndicators: fallbackIndicators.map(i => i.name),
      debugIndicators: debugIndicators.map(i => i.name),
      logic: primaryIndicators.length > 0 ? 'primary' : fallbackIndicators.length > 0 ? 'fallback' : 'none'
    });

    return isPreview;
  }

  /**
   * Check if a selector exists in the path up to maxLevels parent elements
   * INCLUDING traversal through shadow DOM boundaries
   * @private
   */
  static _checkInPath(element, selector, maxLevels = 15) {
    if (!element) return false;

    let current = element;
    for (let i = 0; i < maxLevels && current; i++) {
      // Check if current element matches
      try {
        if (current.matches && current.matches(selector)) {
          return true;
        }
        // Also check with querySelector to find children
        if (current.querySelector && current.querySelector(selector)) {
          return true;
        }
      } catch (e) {
        // Invalid selector, skip
      }

      // Move to parent
      current = current.parentElement;

      // If we hit null but we're in a shadow DOM, try to traverse OUT to the host
      if (!current && element.getRootNode && element.getRootNode() !== document) {
        const shadowRoot = element.getRootNode();
        if (shadowRoot.host) {
          current = shadowRoot.host;
          element = current; // Update element for next getRootNode check
        }
      }
    }

    return false;
  }

  /**
   * NEW: Check for preview indicators by traversing INTO shadow DOMs
   * @private
   */
  static _checkShadowDOMPreview(element, maxLevels = 15) {
    if (!element) return false;

    let current = element;
    for (let i = 0; i < maxLevels && current; i++) {
      // If this element has a shadow DOM, check inside it
      if (current.shadowRoot) {
        // Look for preview indicators inside the shadow DOM
        const shadowPreview = current.shadowRoot.querySelector('.element-preview');
        const shadowHuiSection = current.shadowRoot.querySelector('hui-section[preview]');
        const shadowElementEditor = current.shadowRoot.querySelector('.element-editor');

        if (shadowPreview || shadowHuiSection || shadowElementEditor) {
          cblcarsLog.debug('[MsdInstanceManager] 🎯 Found preview indicator in shadow DOM:', {
            element: current.tagName,
            foundPreview: !!shadowPreview,
            foundHuiSection: !!shadowHuiSection,
            foundElementEditor: !!shadowElementEditor
          });
          return true;
        }

        // Also recursively check elements inside shadow DOM
        const shadowElements = current.shadowRoot.querySelectorAll('*');
        for (const shadowEl of shadowElements) {
          if (MsdInstanceManager._checkShadowDOMPreview(shadowEl, 3)) { // Limited recursion
            return true;
          }
        }
      }

      // Move to parent
      current = current.parentElement;
    }

    return false;
  }

  /**
   * Get extended element path for debugging
   * @private
   */
  static _getExtendedElementPath(element, maxLevels = 15) {
    if (!element) return 'null';

    const path = [];
    let current = element;

    for (let i = 0; i < maxLevels && current; i++) {
      const tagName = current.tagName?.toLowerCase() || 'unknown';
      const id = current.id ? `#${current.id}` : '';
      const className = current.className ? `.${Array.from(current.classList).slice(0, 3).join('.')}` : '';
      const preview = current.hasAttribute?.('preview') ? '[preview]' : '';

      path.push(`${tagName}${id}${className}${preview}`);
      current = current.parentElement;
    }

    return path.join(' → ');
  }  /**
   * Check for specific DOM patterns that indicate preview mode
   * @private
   */
  static _checkDOMPatterns(extendedPath) {
    if (!extendedPath) return false;

    // Look for HIGH PRIORITY patterns that specifically indicate card preview
    const highPriorityPatterns = [
      /element-preview/,                        // .element-preview class (strongest indicator)
      /element-editor/,                         // .element-editor class
      /hui-section.*\[preview\]/,               // hui-section with preview attribute
      /hui-card-preview/,                       // hui-card-preview element
      /hui-card-element-editor/,                // card element editor
    ];

    // Look for LOW PRIORITY patterns that indicate general edit mode but not necessarily preview
    const lowPriorityPatterns = [
      /hui-card-edit-mode/,                     // hui-card-edit-mode (edit mode but not preview)
      /ha-sortable/,                            // ha-sortable element (dashboard edit mode)
      /hui-grid-section.*hui-section/,          // grid section in a hui-section
      /\.card\.fit-rows.*ha-sortable/,          // card in sortable container
      /\.container.*ha-sortable/,               // container with sortable (edit mode)
    ];

    const highPriorityMatch = highPriorityPatterns.find(pattern => pattern.test(extendedPath));
    const lowPriorityMatch = lowPriorityPatterns.find(pattern => pattern.test(extendedPath));

    if (highPriorityMatch) {
      cblcarsLog.debug('[MsdInstanceManager] 🎯 Found HIGH PRIORITY preview pattern:', {
        pattern: highPriorityMatch.source,
        path: extendedPath
      });
      return true;
    }

    if (lowPriorityMatch) {
      cblcarsLog.debug('[MsdInstanceManager] 🔍 Found low priority edit mode pattern:', {
        pattern: lowPriorityMatch.source,
        path: extendedPath,
        note: 'Edit mode detected but not necessarily card preview'
      });
    }

    return false;
  }

  /**
   * Find the card element that contains the mount element (traverse through shadow DOM)
   * @private
   */
  static _findCardElement(mountEl) {
    // Try to get the card instance from global references
    const cardInstance = window.cb_lcars_card_instance || window._currentCardInstance || window.__msdDebug?.cardInstance;

    if (cardInstance) {
      return cardInstance; // This should be the cb-lcars-msd-card element
    }

    // Fallback: try to traverse up from mount element
    // The mount is typically inside shadow DOM, so we need to go through the host
    let current = mountEl;

    while (current) {
      // Check if we hit a shadow root boundary
      if (current.getRootNode && current.getRootNode() !== document) {
        const shadowRoot = current.getRootNode();
        if (shadowRoot.host) {
          current = shadowRoot.host; // Jump to shadow host

          // Check if this is our card element
          if (current.tagName && current.tagName.toLowerCase().includes('cb-lcars-msd-card')) {
            return current;
          }

          continue;
        }
      }

      // Regular DOM traversal
      if (current.tagName && current.tagName.toLowerCase().includes('cb-lcars-msd-card')) {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  }

  /**
   * Check preview mode from card instance context (simplified)
   * @private
   */
  static _checkCardInstancePreview() {
    try {
      const cardInstance = window.cb_lcars_card_instance || window._currentCardInstance;

      if (cardInstance) {
        // Check if the card element has preview indicators in its ancestry
        const cardInPreview = cardInstance.closest?.('.element-preview') ||
                             cardInstance.closest?.('.element-editor');

        if (cardInPreview) {
          cblcarsLog.debug('[MsdInstanceManager] 🎯 Found preview via card instance');
          return true;
        }
      }

      return false;
    } catch (error) {
      cblcarsLog.warn('[MsdInstanceManager] ⚠️ Error checking card instance preview:', error);
      return false;
    }
  }

  /**
   * Get a descriptive path for an element (for debugging)
   * @private
   */
  static _getElementPath(element) {
    if (!element) return 'null';

    const path = [];
    let current = element;

    for (let i = 0; i < 5 && current; i++) {
      const tagName = current.tagName?.toLowerCase() || 'unknown';
      const id = current.id ? `#${current.id}` : '';
      const className = current.className ? `.${Array.from(current.classList).join('.')}` : '';
      const preview = current.hasAttribute?.('preview') ? '[preview]' : '';

      path.push(`${tagName}${id}${className}${preview}`);
      current = current.parentElement;
    }

    return path.join(' → ');
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
        try {
          await instance.systemsManager.destroy();
        } catch (error) {
          cblcarsLog.warn('[MsdInstanceManager] ⚠️ SystemsManager destroy failed:', error);
        }
      }

      // Call other destroy methods if available
      if (instance.destroy && typeof instance.destroy === 'function') {
        try {
          await instance.destroy();
        } catch (error) {
          cblcarsLog.warn('[MsdInstanceManager] ⚠️ Pipeline destroy failed:', error);
        }
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
    cblcarsLog.debug('[MsdInstanceManager] 🎨 Generating MSD preview content', userMsdConfig);

    // userMsdConfig is already at the MSD level, not wrapped in .msd
    const msdConfig = userMsdConfig || {};

    // Check for configuration issues
    let configIssues = [];
    let baseSvg = 'Not configured';

    if (!msdConfig.base_svg?.source) {
      configIssues.push({
        type: 'warning',
        title: 'No Base SVG',
        message: 'Add base_svg.source to your configuration',
        suggestion: 'base_svg:\n  source: builtin:ncc-1701-a-blue'
      });
    } else {
      const source = msdConfig.base_svg.source;
      // Try to validate the SVG source
      try {
        if (typeof window !== 'undefined' && window.cblcars?.getSvgContent) {
          const svgContent = window.cblcars.getSvgContent(source);
          if (!svgContent) {
            const isBuiltin = source.startsWith('builtin:');
            const isUrl = source.startsWith('http');
            const isLocal = source.startsWith('/') || source.startsWith('./');

            let errorMsg = 'SVG not found or failed to load';
            let suggestion = 'Check your source path';

            if (isBuiltin) {
              const svgName = source.replace('builtin:', '');
              errorMsg = `Builtin SVG "${svgName}" not found`;
              suggestion = 'Available: ncc-1701-a-blue, ncc-1701-d, nx-01';
            } else if (isUrl) {
              errorMsg = 'Failed to load SVG from URL';
              suggestion = 'Check URL accessibility and content type';
            } else if (isLocal) {
              errorMsg = 'Failed to load local SVG file';
              suggestion = 'Check file exists in /local/ directory';
            }

            configIssues.push({
              type: 'error',
              title: 'SVG Loading Failed',
              message: errorMsg,
              suggestion: suggestion,
              source: source
            });
            baseSvg = `<span style="color: #ff6666;">${source} (failed)</span>`;
          } else {
            baseSvg = source.startsWith('builtin:') ? source.replace('builtin:', '') : source;
          }
        } else {
          baseSvg = source.startsWith('builtin:') ? source.replace('builtin:', '') : source;
        }
      } catch (error) {
        configIssues.push({
          type: 'error',
          title: 'SVG Error',
          message: error.message || error.toString(),
          source: source
        });
        baseSvg = `<span style="color: #ff6666;">${source} (error)</span>`;
      }
    }

    // Extract real configuration information
    const baseSvgSource = msdConfig.base_svg?.source;

    if (!baseSvgSource) {
      baseSvg = '<span style="color: var(--lcars-orange, #ff9900);">Not configured</span>';
    } else if (baseSvgSource.startsWith('builtin:')) {
      baseSvg = baseSvgSource.replace('builtin:', '');
    } else {
      baseSvg = baseSvgSource;
    }    const overlayCount = (msdConfig.overlays || []).length;
    const dataSourceCount = Object.keys(msdConfig.data_sources || {}).length;
    const rulesCount = (msdConfig.rules || []).length;
    const anchorCount = Object.keys(msdConfig.anchors || {}).length;
    const routeCount = (msdConfig.routes || []).length;

    // Additional useful config info
    const hasAnimations = !!(msdConfig.animations && Object.keys(msdConfig.animations).length > 0);
    const hasPalettes = !!(msdConfig.palettes && Object.keys(msdConfig.palettes).length > 0);
    const debugMode = !!(msdConfig.debug && msdConfig.debug.enabled);
    const version = msdConfig.version || 'unknown';

    // Generate issues HTML if any
    let issuesHtml = '';
    if (configIssues.length > 0) {
      issuesHtml = `
        <div style="
          margin: 16px 0;
          padding: 12px;
          background: rgba(0,0,0,0.4);
          border-radius: 6px;
          border-left: 4px solid ${configIssues.some(i => i.type === 'error') ? '#ff6666' : '#ff9900'};
        ">
          <div style="font-size: 12px; font-weight: bold; margin-bottom: 8px; color: ${configIssues.some(i => i.type === 'error') ? '#ff6666' : '#ff9900'};">
            ${configIssues.some(i => i.type === 'error') ? '❌' : '⚠️'} Configuration ${configIssues.some(i => i.type === 'error') ? 'Errors' : 'Warnings'}
          </div>
          ${configIssues.map(issue => `
            <div style="margin-bottom: 8px; font-size: 10px;">
              <div style="font-weight: bold; color: ${issue.type === 'error' ? '#ffcccc' : '#ffcc99'};">
                ${issue.title}
              </div>
              <div style="margin: 2px 0; opacity: 0.9;">
                ${issue.message}
              </div>
              ${issue.source ? `<div style="font-family: monospace; font-size: 9px; opacity: 0.7;">Source: ${issue.source}</div>` : ''}
              ${issue.suggestion ? `<div style="margin-top: 4px; padding: 4px; background: rgba(0,0,0,0.3); border-radius: 3px; font-family: monospace; font-size: 9px; color: #cccccc;">${issue.suggestion.replace(/\n/g, '<br/>')}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }

    return {
      enabled: true,
      preview: true,
      html: `
        <div style="
          width: 100%;
          height: 400px;
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
          <div style="z-index: 1; text-align: center; width: 90%; max-height: 100%; overflow-y: auto;">
            <div style="font-size: 24px; font-weight: bold; margin-bottom: 16px; color: var(--lcars-orange, #ff9900);">
              CB-LCARS MSD Preview
            </div>

            <div style="font-size: 14px; margin-bottom: 8px;">
              Master Systems Display Configuration
            </div>

            <div style="font-size: 11px; margin-bottom: 16px; opacity: 0.7;">
              Version ${version}
            </div>

            ${issuesHtml}            <div style="
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
                <div>Anchors:</div>
                <div>Routes:</div>
              </div>
              <div style="text-align: left; color: var(--lcars-yellow, #ffcc00);">
                <div>${baseSvg.replace('builtin:', '')}</div>
                <div>${overlayCount}</div>
                <div>${dataSourceCount}</div>
                <div>${rulesCount}</div>
                <div>${anchorCount}</div>
                <div>${routeCount}</div>
              </div>
            </div>

            <!-- Additional features -->
            <div style="
              display: flex;
              justify-content: center;
              gap: 12px;
              margin: 16px 0;
              font-size: 10px;
            ">
              <span style="
                padding: 2px 6px;
                background: ${hasAnimations ? 'var(--lcars-green, #00ff00)' : 'var(--lcars-gray, #666666)'};
                color: black;
                border-radius: 3px;
                font-weight: bold;
              ">ANIMATIONS</span>
              <span style="
                padding: 2px 6px;
                background: ${hasPalettes ? 'var(--lcars-green, #00ff00)' : 'var(--lcars-gray, #666666)'};
                color: black;
                border-radius: 3px;
                font-weight: bold;
              ">PALETTES</span>
              <span style="
                padding: 2px 6px;
                background: ${debugMode ? 'var(--lcars-orange, #ff9900)' : 'var(--lcars-gray, #666666)'};
                color: black;
                border-radius: 3px;
                font-weight: bold;
              ">DEBUG</span>
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
  }  /**
   * Create blocked instance content
   * @private
   */
  static _createBlockedContent(existingMount, requestedMount) {
    const existingMountInfo = MsdInstanceManager._getMountInfo(existingMount);
    const requestedMountInfo = MsdInstanceManager._getMountInfo(requestedMount);

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
          Active: ${existingMountInfo}<br/>
          Requested: ${requestedMountInfo}
        </div>

        <div style="
          font-size: 12px;
          color: var(--lcars-orange, #ff9900);
          background: rgba(255, 153, 0, 0.1);
          padding: 8px 12px;
          border-radius: 4px;
          border: 1px solid var(--lcars-orange, #ff9900);
          margin-top: 8px;
        ">
          💡 Refresh the page to reset MSD instances
        </div>

        <div style="font-size: 10px; margin-top: 12px; opacity: 0.6;">
          Only one MSD instance allowed per window
        </div>
      </div>
    `;
  }

  /**
   * Get useful information about a mount element
   * @private
   */
  static _getMountInfo(element) {
    if (!element) return 'unknown';

    const tagName = element.tagName?.toLowerCase() || 'unknown';
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className ? ` .${Array.from(element.classList).slice(0, 2).join('.')}` : '';
    const preview = element.hasAttribute?.('preview') ? ' [preview]' : '';

    // Try to find a more descriptive parent
    const parent = element.parentElement;
    const parentTag = parent?.tagName?.toLowerCase();
    const parentInfo = parentTag && parentTag !== 'div' ? ` in ${parentTag}` : '';

    return `${tagName}${id}${classes}${preview}${parentInfo}`;
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