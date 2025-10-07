import { processAndValidateConfig } from './ConfigProcessor.js';
import { SystemsManager } from './SystemsManager.js';
import { ModelBuilder } from './ModelBuilder.js';
import { setupDebugInterface } from '../debug/DebugInterface.js';
import { buildCardModel } from '../model/CardModel.js';
import { MsdApi } from '../api/MsdApi.js';
import { StatusGridRenderer } from '../renderer/StatusGridRenderer.js';
import { exportCollapsed, exportCollapsedJson } from '../export/exportCollapsed.js';
import { exportFullSnapshot, exportFullSnapshotJson } from '../export/exportFullSnapshot.js';
import { diffItem } from '../export/diffItem.js';
import { perfGetAll } from '../perf/PerfCounters.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Initialize the MSD processing/rendering pipeline.
 * ENHANCED: Ensures pack loading and defaults management complete before overlay processing
 *
 * @param {Object} userMsdConfig - User supplied MSD config.
 * @param {HTMLElement|ShadowRoot} mountEl - Mount/root element (may be a shadowRoot).
 * @param {Object|null} hass - Home Assistant instance (if available).
 * @returns {Promise<Object>} Pipeline API
 */
export async function initMsdPipeline(userMsdConfig, mountEl, hass = null) {
  cblcarsLog.debug('[PipelineCore] 🚀 Starting MSD pipeline initialization with enhanced sequencing');

  // PHASE 1: Configuration processing and pack merging
  cblcarsLog.debug('[PipelineCore] 📋 Phase 1: Processing and validating configuration');
  const { mergedConfig, issues, provenance } = await processAndValidateConfig(userMsdConfig);

  // Handle validation errors early
  if (issues.errors.length) {
    cblcarsLog.error('[PipelineCore] Validation errors – pipeline disabled', issues.errors);
    return createDisabledPipeline(mergedConfig, issues, provenance);
  }

  // PHASE 2: Initialize SystemsManager with defaults loading BEFORE any overlay processing
  cblcarsLog.debug('[PipelineCore] 🔧 Phase 2: Initializing SystemsManager and loading pack defaults');
  const systemsManager = new SystemsManager();

  // CRITICAL: Initialize systems with pack defaults loading before overlay processing
  try {
    await systemsManager.initializeSystemsWithPacksFirst(mergedConfig, mountEl, hass);
  } catch (error) {
    cblcarsLog.error('[PipelineCore] ❌ SystemsManager initialization failed:', error);
    throw new Error(`SystemsManager initialization failed: ${error.message}`);
  }

  // Verify defaults manager is ready with enhanced validation
  if (!systemsManager.defaultsManager) {
    throw new Error('DefaultsManager initialization failed - cannot proceed with overlay rendering');
  }

  // Validate essential packs are loaded
  const introspectionData = systemsManager.defaultsManager.getIntrospectionData();

  cblcarsLog.debug('[PipelineCore] 🔍 Pack validation - full introspection:', introspectionData);

  // The introspection data structure should be checked more carefully
  // We need to look for actual pack names, not configuration paths
  let packsFound = [];
  let corePackFound = false;

  // Check if introspection has a packs section or similar
  if (introspectionData.layers && introspectionData.layers.pack) {
    // The pack layers might be structured differently
    const packData = introspectionData.layers.pack;

    // Try different ways to extract pack information
    if (typeof packData === 'object') {
      // If it's an object, we need to find actual pack references
      const keys = Object.keys(packData);

      // Look for pack metadata or check if these are actually pack names
      for (const key of keys) {
        if (typeof key === 'string') {
          // Check if this looks like a pack name (no dots) vs a setting path (has dots)
          if (!key.includes('.')) {
            packsFound.push(key);
            if (key === 'core') corePackFound = true;
          }
        }
      }

      // If we didn't find pack names, try to extract from the provenance
      if (packsFound.length === 0 && mergedConfig.__provenance) {
        const provenancePackLayers = mergedConfig.__provenance.merge_order?.filter(layer => layer.type === 'builtin') || [];
        packsFound = provenancePackLayers.map(layer => layer.pack);
        corePackFound = packsFound.includes('core');

        cblcarsLog.debug('[PipelineCore] 🔍 Extracted pack names from provenance:', packsFound);
      }
    }
  }

  cblcarsLog.debug('[PipelineCore] 🔍 Pack validation results:', {
    introspectionStructure: typeof introspectionData.layers?.pack,
    packsFound,
    corePackFound,
    introspectionKeys: introspectionData.layers?.pack ? Object.keys(introspectionData.layers.pack).slice(0, 5) : []
  });

  if (!corePackFound) {
    cblcarsLog.warn('[PipelineCore] ⚠️ Core pack not found in defaults manager - some features may not work');
    cblcarsLog.debug('[PipelineCore] Available packs:', packsFound);
  } else {
    cblcarsLog.debug('[PipelineCore] ✅ Core pack validated in defaults manager');
  }  cblcarsLog.debug('[PipelineCore] ✅ Pack defaults loaded and ready:', {
    hasDefaultsManager: !!systemsManager.defaultsManager,
    packsLoaded: packsFound,
    totalPackDefaults: packsFound.length
  });

  // PHASE 3: Build card model (now safe to process overlays)
  cblcarsLog.debug('[PipelineCore] 🏗️ Phase 3: Building card model');
  const cardModel = await buildCardModel(mergedConfig);

  // Ensure anchors are available
  if (!cardModel.anchors) cardModel.anchors = {};
  if (!Object.keys(cardModel.anchors).length) {
    if (mergedConfig.anchors && Object.keys(mergedConfig.anchors).length) {
      cardModel.anchors = { ...mergedConfig.anchors };
      cblcarsLog.debug('[PipelineCore] Adopted user anchors');
    }
  }

  // PHASE 4: Complete systems initialization with card model
  cblcarsLog.debug('[PipelineCore] ⚙️ Phase 4: Completing systems initialization');
  try {
    await systemsManager.completeSystems(mergedConfig, cardModel, mountEl);
  } catch (error) {
    cblcarsLog.error('[PipelineCore] ❌ Systems completion failed:', error);
    throw new Error(`Systems completion failed: ${error.message}`);
  }

  // ADDED: Set original HASS for clean controls separation
  if (hass) {
    systemsManager.setOriginalHass(hass);
  }


  // PHASE 5: Early debug and routing setup
  cblcarsLog.debug('[PipelineCore] 🔍 Phase 5: Setting up debug infrastructure');
  if (typeof window !== 'undefined') {
    window.__msdDebug = window.__msdDebug || {};
    window.__msdDebug.debugManager = systemsManager.debugManager;
    window.__msdDebug.routing = systemsManager.router;

    // Make core systems available BEFORE any overlay rendering
    window.__msdDebug.pipelineInstance = {
      systemsManager: systemsManager,
      dataSourceManager: systemsManager.dataSourceManager,
      config: mergedConfig,
      defaultsManager: systemsManager.defaultsManager
    };

    cblcarsLog.debug('[PipelineCore] Essential subsystems ready for overlay rendering:', {
      hasSystemsManager: !!systemsManager,
      hasDataSourceManager: !!systemsManager.dataSourceManager,
      hasDefaultsManager: !!systemsManager.defaultsManager,
      hasRouter: !!systemsManager.router,
      dataSourceCount: systemsManager.dataSourceManager?.listIds?.()?.length || 0
    });

    // Dispatch routing ready event
    try {
      window.dispatchEvent(new CustomEvent('msd-routing-ready'));
    } catch (e) {
      // Non-fatal; older browsers or sandbox contexts might block custom events.
    }
  }

  // PHASE 6: Initialize model builder (now everything is ready)
  cblcarsLog.debug('[PipelineCore] 🏭 Phase 6: Initializing model builder');
  const modelBuilder = new ModelBuilder(mergedConfig, cardModel, systemsManager);

  // Store ModelBuilder reference in SystemsManager for accessibility
  systemsManager.modelBuilder = modelBuilder;

  /**
   * Internal re-render function that recomputes the model
   * and triggers the AdvancedRenderer + debug visualization pipeline.
   * @returns {Object|undefined} Renderer result object
   */
  async function reRender() {
    cblcarsLog.debug('[PipelineCore] 🔄 reRender() ENTRY', {
      timestamp: new Date().toISOString(),
      renderInProgress: systemsManager._renderInProgress,
      defaultsManagerReady: !!systemsManager.defaultsManager
    });

    // ENHANCED: Verify defaults manager is still available
    if (!systemsManager.defaultsManager) {
      cblcarsLog.error('[PipelineCore] ❌ DefaultsManager not available during re-render - aborting');
      return { success: false, error: 'DefaultsManager not available' };
    }

    // IMPROVED: Queue renders instead of blocking them
    if (systemsManager._renderInProgress) {
      cblcarsLog.debug('[PipelineCore] 🕐 Render in progress, queueing re-render');
      systemsManager._queuedReRender = true;
      return { success: false, reason: 'render_in_progress', queued: true };
    }

    systemsManager._renderInProgress = true;
    systemsManager._queuedReRender = false;

    try {
      cblcarsLog.debug('[PipelineCore] 📊 Computing resolved model...');
      const startTime = performance.now();
      const resolvedModel = modelBuilder.computeResolvedModel();

      cblcarsLog.debug('[PipelineCore] ✅ Resolved model computed:', {
        overlayCount: resolvedModel.overlays.length,
        controlOverlays: resolvedModel.overlays.filter(o => o.type === 'control').length,
        hasAnchors: !!resolvedModel.anchors,
        hasViewBox: !!resolvedModel.viewBox
      });

      cblcarsLog.debug(`[PipelineCore] 🎨 Starting AdvancedRenderer.render() - overlays: ${resolvedModel.overlays.length}`);

      // ADDED: Defensive rendering with error boundary
      let renderResult;
      try {
        renderResult = systemsManager.renderer.render(resolvedModel);
        cblcarsLog.debug('[PipelineCore] ✅ AdvancedRenderer.render() completed successfully:', renderResult);
      } catch (renderError) {
        cblcarsLog.error('[PipelineCore] ❌ AdvancedRenderer.render() FAILED:', renderError);
        cblcarsLog.error('[PipelineCore] ❌ Render error stack:', renderError.stack);
        return { success: false, error: renderError.message, phase: 'advanced_renderer' };
      }

      cblcarsLog.debug('[PipelineCore] 🎮 Starting renderDebugAndControls()...');
      // CHANGED: Make debug and controls rendering more defensive
      try {
        await systemsManager.renderDebugAndControls(resolvedModel, mountEl);
        cblcarsLog.debug('[PipelineCore] ✅ renderDebugAndControls() completed successfully');
      } catch (debugControlsError) {
        cblcarsLog.error('[PipelineCore] ❌ renderDebugAndControls() FAILED:', debugControlsError);
        cblcarsLog.error('[PipelineCore] ❌ Debug/Controls error stack:', debugControlsError.stack);
        // Don't fail the entire render - just log the error
        cblcarsLog.warn('[PipelineCore] ⚠️ Continuing without debug/controls rendering due to error');
      }

      const renderTime = performance.now() - startTime;
      cblcarsLog.debug(`[PipelineCore] ✅ reRender() COMPLETED in ${renderTime.toFixed(2)}ms`);

      return renderResult || { success: true };

    } catch (error) {
      cblcarsLog.error('[PipelineCore] ❌ reRender() COMPLETELY FAILED:', error);
      cblcarsLog.error('[PipelineCore] ❌ Complete failure stack:', error.stack);
      return { success: false, error: error.message };
    } finally {
      systemsManager._renderInProgress = false;
      cblcarsLog.debug('[PipelineCore] 🏁 reRender() FINALLY block - _renderInProgress reset to false');

      // IMPROVED: Execute queued re-render if one was requested
      if (systemsManager._queuedReRender) {
        cblcarsLog.debug('[PipelineCore] 🔄 Executing queued re-render');
        systemsManager._queuedReRender = false;
        // Use setTimeout to avoid immediate recursion and allow stack to clear
        setTimeout(() => reRender(), 50);
      }
    }
  }

  // Connect reRender callback to systems
  systemsManager.setReRenderCallback(reRender);

  // PHASE 7: Initial render - now everything is properly sequenced
  cblcarsLog.debug('[PipelineCore] 🎬 Phase 7: Performing initial render');
  cblcarsLog.debug('[PipelineCore] DataSourceManager status:', {
    sourcesCount: systemsManager.dataSourceManager?.getAllSources?.()?.length || 0,
    entityCount: systemsManager.dataSourceManager?.listIds?.()?.length || 0
  });

  const initialRenderResult = await reRender();

  cblcarsLog.debug('[PipelineCore] Initial render completed:', {
    overlayCount: initialRenderResult?.overlayCount || 0,
    errors: initialRenderResult?.errors || 0
  });

  // PHASE 8: Create pipeline API and finalize
  cblcarsLog.debug('[PipelineCore] 🔌 Phase 8: Creating pipeline API');
  const pipelineApi = createPipelineApi(
    mergedConfig, cardModel, systemsManager, modelBuilder, reRender
  );

  // Setup debug interface with DebugManager integration
  setupDebugInterface(pipelineApi, mergedConfig, provenance, systemsManager, modelBuilder);

  // Initialize HUD service with mount element
  if (typeof window !== 'undefined' && window.__msdDebug?.hud?.setMountElement) {
    window.__msdDebug.hud.setMountElement(mountEl);
  }

  // Attach unified API
  cblcarsLog.debug('[PipelineCore] Attaching unified API');
  MsdApi.attach();

  // Augment debug tracking (now that pipelineApi exists)
  if (typeof window !== 'undefined') {
    window.__msdDebug = window.__msdDebug || {};
    window.__msdDebug.validation = { issues: () => mergedConfig.__issues };
    window.__msdDebug.pipelineInstance = pipelineApi;
    window.__msdDebug._provenance = provenance;

    // Ensure routing reference is consistent (in case late changes happened)
    if (!window.__msdDebug.routing) {
      window.__msdDebug.routing = systemsManager.router;
      try {
        window.dispatchEvent(new CustomEvent('msd-routing-ready'));
      } catch(_) {}
    }
  }

  cblcarsLog.debug('[PipelineCore] ✅ Pipeline initialization complete with enhanced sequencing');
  return pipelineApi;
}

function createDisabledPipeline(mergedConfig, issues, provenance) {
  // Create styled error content
  const errorHtml = createValidationErrorDisplay(issues, mergedConfig);

  const disabledPipeline = {
    enabled: false,
    errors: issues.errors,
    warnings: issues.warnings,
    html: errorHtml, // ADDED: HTML content for rendering
    getResolvedModel: () => null,
    ingestHass: () => {},
    updateEntities: () => {},
    listEntities: () => [],
    getEntity: () => null,
    getActiveProfiles: () => [],
    getAnchors: () => (mergedConfig.anchors || {}),
    repairAnchorsFromMerged: () => false,
    exportCollapsed: () => null,
    exportCollapsedJson: () => 'null',
    exportFullSnapshot: () => null,
    exportFullSnapshotJson: () => 'null',
    diffItem: () => null,
    getPerf: () => ({})
  };

  if (typeof window !== 'undefined') {
    window.__msdDebug = window.__msdDebug || {};
    window.__msdDebug.validation = { issues: () => mergedConfig.__issues };
    window.__msdDebug.pipelineInstance = disabledPipeline;
    window.__msdDebug._provenance = provenance;
  }
  return disabledPipeline;
}

/**
 * Create styled error display for validation failures
 * @private
 */
function createValidationErrorDisplay(issues, mergedConfig) {
  const errorCount = issues.errors.length;
  const warningCount = issues.warnings.length;

  // Group errors by type for better display
  const groupedErrors = {};
  issues.errors.forEach(error => {
    const category = error.code?.split('.')[0] || 'general';
    if (!groupedErrors[category]) groupedErrors[category] = [];
    groupedErrors[category].push(error);
  });

  let errorsHtml = '';
  Object.entries(groupedErrors).forEach(([category, categoryErrors]) => {
    errorsHtml += `
      <div style="margin-bottom: 16px;">
        <h4 style="
          color: #ff6666;
          font-size: 16px;
          margin: 0 0 8px 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        ">${category} (${categoryErrors.length})</h4>
        ${categoryErrors.slice(0, 5).map(error => `
          <div style="
            margin: 6px 0;
            padding: 8px;
            background: rgba(255, 102, 102, 0.1);
            border-left: 3px solid #ff6666;
            border-radius: 0 4px 4px 0;
          ">
            <div style="font-weight: bold; font-size: 14px; color: #ffcccc;">
              ${error.code || 'VALIDATION_ERROR'}
            </div>
            <div style="font-size: 13px; margin-top: 2px; line-height: 1.3;">
              ${error.message || error.msg || 'Unknown validation error'}
            </div>
            ${error.overlay ? `<div style="font-size: 12px; opacity: 0.8; margin-top: 2px;">Overlay: ${error.overlay}</div>` : ''}
            ${error.anchor ? `<div style="font-size: 12px; opacity: 0.8; margin-top: 2px;">Anchor: ${error.anchor}</div>` : ''}
          </div>
        `).join('')}
        ${categoryErrors.length > 5 ? `
          <div style="font-size: 12px; opacity: 0.6; text-align: center; margin-top: 4px;">
            ... ${categoryErrors.length - 5} more ${category} errors
          </div>
        ` : ''}
      </div>
    `;
  });

  // Show some warnings if we have space
  let warningsHtml = '';
  if (warningCount > 0 && errorCount < 10) {
    warningsHtml = `
      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #444;">
        <h4 style="
          color: #ffaa00;
          font-size: 14px;
          margin: 0 0 8px 0;
          text-transform: uppercase;
        ">Warnings (${warningCount})</h4>
        ${issues.warnings.slice(0, 3).map(warning => `
          <div style="
            margin: 4px 0;
            padding: 6px;
            background: rgba(255, 170, 0, 0.1);
            border-left: 2px solid #ffaa00;
            border-radius: 0 3px 3px 0;
            font-size: 12px;
          ">
            ${warning.message || warning.msg || 'Unknown warning'}
          </div>
        `).join('')}
        ${warningCount > 3 ? `
          <div style="font-size: 12px; opacity: 0.6; text-align: center;">
            ... ${warningCount - 3} more warnings
          </div>
        ` : ''}
      </div>
    `;
  }

  return `
    <div style="
      width: 99%;
      height: 400px;
      background: linear-gradient(135deg, #220011 0%, #110006 100%);
      border: 2px solid #ff6666;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      color: #ff6666;
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
          radial-gradient(circle at 20% 20%, rgba(255,102,102,0.1) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(255,170,0,0.1) 0%, transparent 50%);
        z-index: 0;
      "></div>

      <!-- Header -->
      <div style="
        z-index: 1;
        text-align: center;
        padding: 20px 20px 16px 20px;
        border-bottom: 1px solid #444;
      ">
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">
          ❌ MSD Configuration Error
        </div>
        <div style="font-size: 14px; color: #ffcccc;">
          ${errorCount} validation ${errorCount === 1 ? 'error' : 'errors'} must be fixed
        </div>
        ${warningCount > 0 ? `
          <div style="font-size: 13px; color: #ffcc99; margin-top: 4px;">
            ${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'} detected
          </div>
        ` : ''}
      </div>

      <!-- Content -->
      <div style="
        z-index: 1;
        flex: 1;
        padding: 16px 20px;
        overflow-y: auto;
        max-height: calc(100% - 120px);
      ">
        ${errorsHtml}
        ${warningsHtml}
      </div>

      <!-- Footer -->
      <div style="
        z-index: 1;
        text-align: center;
        padding: 12px;
        border-top: 1px solid #444;
        background: rgba(0,0,0,0.3);
      ">
        <div style="font-size: 12px; opacity: 0.8;">
          Fix configuration errors to enable MSD rendering
        </div>
      </div>

      <!-- Corner accents -->
      <div style="
        position: absolute;
        top: 10px;
        right: 10px;
        width: 30px;
        height: 30px;
        border-top: 2px solid #ff6666;
        border-right: 2px solid #ff6666;
        border-radius: 0 6px 0 0;
        z-index: 1;
      "></div>
      <div style="
        position: absolute;
        bottom: 10px;
        left: 10px;
        width: 30px;
        height: 30px;
        border-bottom: 2px solid #ff6666;
        border-left: 2px solid #ff6666;
        border-radius: 0 0 0 6px;
        z-index: 1;
      "></div>
    </div>
  `;
}

/**
 * Creates and returns the MSD pipeline external API.
 * @param {Object} mergedConfig
 * @param {Object} cardModel
 * @param {SystemsManager} systemsManager
 * @param {ModelBuilder} modelBuilder
 * @param {Function} reRender
 * @returns {Object} API
 */
function createPipelineApi(mergedConfig, cardModel, systemsManager, modelBuilder, reRender) {
  const api = {
    enabled: true,
    version: mergedConfig.version || 1,
    config: mergedConfig,

    // Core systems
    systemsManager,
    dataSourceManager: systemsManager.dataSourceManager,
    rulesEngine: systemsManager.rulesEngine,
    renderer: systemsManager.renderer,
    router: systemsManager.router,

    /**
     * Inspect routing for a given overlay id and compute path data.
     * @param {string} id
     * @returns {Object|null}
     */
    routingInspect: (id) => {
      const resolvedModel = modelBuilder.getResolvedModel();
      const ov = (resolvedModel?.overlays || []).find(o => o.id === id);
      if (!ov) return null;
      const raw = ov._raw || ov.raw || {};
      const a1 = cardModel.anchors[raw.anchor];
      const a2 = cardModel.anchors[raw.attach_to] || cardModel.anchors[raw.attachTo];
      if (!a1 || !a2) return null;
      const req = systemsManager.router.buildRouteRequest(ov, a1, a2);
      return systemsManager.router.computePath(req);
    },

    getResolvedModel: () => modelBuilder.getResolvedModel(),

    /**
     * Force a manual re-render.
     */
    reRender: () => {
      try {
        cblcarsLog.debug('[PipelineCore] Manual re-render triggered');
        return reRender();
      } catch (error) {
        cblcarsLog.error('[PipelineCore] Manual re-render failed:', error);
        return { success: false, error: error.message };
      }
    },

    /**
     * Set or update an anchor point.
     * @param {string} id
     * @param {Array<number>} pt
     * @returns {boolean}
     */
    setAnchor(id, pt) {
      if (!id || !Array.isArray(pt) || pt.length !== 2) return false;
      if (!cardModel.anchors) cardModel.anchors = {};
      cardModel.anchors[id] = [Number(pt[0]), Number(pt[1])];
      const resolvedModel = modelBuilder.getResolvedModel();
      if (resolvedModel?.anchors) resolvedModel.anchors[id] = cardModel.anchors[id];
      systemsManager.router.invalidate && systemsManager.router.invalidate('*');
      try {
        if (systemsManager.renderer && resolvedModel) {
          systemsManager.renderer._routerOverlaySync = false;
          systemsManager.renderer.render(resolvedModel);
        }
      } catch(_) {}
      return true;
    },

    ingestHass: (hass) => systemsManager.ingestHass(hass),
    updateEntities: (map) => systemsManager.updateEntities(map),
    listEntities: () => systemsManager.entityRuntime.listIds(),
    getEntity: (id) => systemsManager.entityRuntime.getEntity(id),
    getActiveProfiles: () => modelBuilder.runtimeActiveProfiles.slice(),
    getAnchors: () => ({ ...cardModel.anchors }),
    exportCollapsed: () => exportCollapsed(userMsdConfig),
    exportCollapsedJson: () => JSON.stringify(exportCollapsed(userMsdConfig)),
    exportFullSnapshot: () => exportFullSnapshot(mergedConfig),
    exportFullSnapshotJson: () => JSON.stringify(exportFullSnapshot(mergedConfig)),
    diffItem: (item) => diffItem(item),
    getPerf: () => perfGetAll(),

    // Add debug API powered by DebugManager
    debug: {
      enable: (feature) => systemsManager.debugManager.enable(feature),
      disable: (feature) => systemsManager.debugManager.disable(feature),
      toggle: (feature) => systemsManager.debugManager.toggle(feature),
      setScale: (scale) => systemsManager.debugManager.setScale(scale),
      status: () => systemsManager.debugManager.getSnapshot(),
      onChange: (callback) => systemsManager.debugManager.onChange(callback)
    },

    getDataSourceManager: () => systemsManager.dataSourceManager,
    _reRenderCallback: reRender,

    // Action system methods
    setCardInstance: (cardInstance) => {
      cblcarsLog.debug('[PipelineCore] Setting card instance:', {
        hasCardInstance: !!cardInstance,
        cardType: cardInstance?.tagName,
        hasHandleAction: typeof cardInstance?._handleAction,
        hasHass: !!cardInstance?.hass
      });
      StatusGridRenderer.setCardInstance(cardInstance);
      // Store in SystemsManager too for broader access
      systemsManager.cardInstance = cardInstance;
      cblcarsLog.debug('[PipelineCore] Card instance set via API for action system');
    }
  };

  return api;
}

