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
  await systemsManager.initializeSystemsWithPacksFirst(mergedConfig, mountEl, hass);
  
  // Verify defaults manager is ready
  if (!systemsManager.defaultsManager) {
    throw new Error('DefaultsManager initialization failed - cannot proceed with overlay rendering');
  }
  
  cblcarsLog.debug('[PipelineCore] ✅ Pack defaults loaded and ready:', {
    hasDefaultsManager: !!systemsManager.defaultsManager,
    packsLoaded: systemsManager.defaultsManager.getIntrospectionData().layers.pack || {}
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
  await systemsManager.completeSystems(mergedConfig, cardModel);

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
      dataSourceManager: systemsManager.dataSourceManager
    };

    cblcarsLog.debug('[PipelineCore] Essential subsystems ready for overlay rendering:', {
      hasSystemsManager: !!systemsManager,
      hasDataSourceManager: !!systemsManager.dataSourceManager,
      hasDefaultsManager: !!systemsManager.defaultsManager,
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

// Rest of the file remains the same...
function createDisabledPipeline(mergedConfig, issues, provenance) {
  // ... existing implementation
}

function createValidationErrorDisplay(issues, mergedConfig) {
  // ... existing implementation  
}

function createPipelineApi(mergedConfig, cardModel, systemsManager, modelBuilder, reRender) {
  // ... existing implementation
}