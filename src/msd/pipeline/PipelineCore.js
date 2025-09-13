import { processAndValidateConfig } from './ConfigProcessor.js';
import { SystemsManager } from './SystemsManager.js';
import { ModelBuilder } from './ModelBuilder.js';
import { setupDebugInterface } from '../debug/DebugInterface.js';
import { buildCardModel } from '../model/CardModel.js';
import { MsdApi } from '../api/MsdApi.js';
import { exportCollapsed, exportCollapsedJson } from '../export/exportCollapsed.js';
import { exportFullSnapshot, exportFullSnapshotJson } from '../export/exportFullSnapshot.js';
import { diffItem } from '../export/diffItem.js';
import { perfGetAll } from '../perf/PerfCounters.js';

/**
 * Initialize the MSD processing/rendering pipeline.
 * Handles config merge/validation, system initialization, initial render,
 * debug interface binding, and exposes a unified pipeline API.
 *
 * @param {Object} userMsdConfig - User supplied MSD config.
 * @param {HTMLElement|ShadowRoot} mountEl - Mount/root element (may be a shadowRoot).
 * @param {Object|null} hass - Home Assistant instance (if available).
 * @returns {Promise<Object>} Pipeline API
 */
export async function initMsdPipeline(userMsdConfig, mountEl, hass = null) {
  // Process and validate configuration
  const { mergedConfig, issues, provenance } = await processAndValidateConfig(userMsdConfig);

  // Handle validation errors
  if (issues.errors.length) {
    console.error('[MSD v1] Validation errors – pipeline disabled', issues.errors);
    return createDisabledPipeline(mergedConfig, issues, provenance);
  }

  // Build card model
  const cardModel = await buildCardModel(mergedConfig);

  // Ensure anchors are available
  if (!cardModel.anchors) cardModel.anchors = {};
  if (!Object.keys(cardModel.anchors).length) {
    if (mergedConfig.anchors && Object.keys(mergedConfig.anchors).length) {
      cardModel.anchors = { ...mergedConfig.anchors };
      console.info('[MSD v1] Adopted user anchors');
    }
  }

  // Initialize all systems
  const systemsManager = new SystemsManager();
  await systemsManager.initializeSystems(mergedConfig, cardModel, mountEl, hass);

  // ADDED: Set original HASS for clean controls separation
  if (hass) {
      systemsManager.setOriginalHass(hass);
  }

  // Connect DebugManager to window.__msdDebug early for console access
  if (typeof window !== 'undefined') {
    window.__msdDebug = window.__msdDebug || {};
    window.__msdDebug.debugManager = systemsManager.debugManager;
    window.__msdDebug.routing = systemsManager.router;
  }

  // EARLY DEBUG BOOTSTRAP (Before first render):
  // Provide a minimal __msdDebug object so debug renderers that run during the first render
  // can access routing / perf safely. This prevents timing race warnings for routing guides.
  if (typeof window !== 'undefined') {
    window.__msdDebug = window.__msdDebug || {};
    // Only set if not already present to avoid clobbering previous instrumentation
    if (!window.__msdDebug.routing) {
      window.__msdDebug.routing = systemsManager.router;
    }
    if (!window.__msdDebug.getPerf) {
      window.__msdDebug.getPerf = () => perfGetAll();
    }
    if (!window.__msdDebug.systemsManager) {
      window.__msdDebug.systemsManager = systemsManager;
    }
    // Dispatch an event so listeners (e.g., MsdDebugRenderer) can react when routing is ready.
    try {
      window.dispatchEvent(new CustomEvent('msd-routing-ready'));
    } catch (e) {
      // Non-fatal; older browsers or sandbox contexts might block custom events.
    }
  }

  // Initialize model builder
  const modelBuilder = new ModelBuilder(mergedConfig, cardModel, systemsManager);

  /**
   * Internal re-render function that recomputes the model
   * and triggers the AdvancedRenderer + debug visualization pipeline.
   * @returns {Object|undefined} Renderer result object
   */
  async function reRender() {
    console.log('[MSD DEBUG] 🔄 reRender() ENTRY', {
      timestamp: new Date().toISOString(),
      renderInProgress: systemsManager._renderInProgress,
      stackTrace: new Error().stack.split('\n').slice(1, 4).join('\n')
    });

    // ADDED: Prevent re-entrant renders
    if (systemsManager._renderInProgress) {
      console.log('[MSD DEBUG] ⚠️ reRender() SKIPPED - already in progress');
      return { success: false, reason: 'render_in_progress' };
    }

    systemsManager._renderInProgress = true;

    try {
      console.log('[MSD DEBUG] 📊 Computing resolved model...');
      const startTime = performance.now();
      const resolvedModel = modelBuilder.computeResolvedModel();

      console.log('[MSD DEBUG] ✅ Resolved model computed:', {
        overlayCount: resolvedModel.overlays.length,
        controlOverlays: resolvedModel.overlays.filter(o => o.type === 'control').length,
        hasAnchors: !!resolvedModel.anchors,
        hasViewBox: !!resolvedModel.viewBox
      });

      console.log(`[MSD DEBUG] 🎨 Starting AdvancedRenderer.render() - overlays: ${resolvedModel.overlays.length}`);

      // ADDED: Defensive rendering with error boundary
      let renderResult;
      try {
        renderResult = systemsManager.renderer.render(resolvedModel);
        console.log('[MSD DEBUG] ✅ AdvancedRenderer.render() completed successfully:', renderResult);
      } catch (renderError) {
        console.error('[MSD DEBUG] ❌ AdvancedRenderer.render() FAILED:', renderError);
        console.error('[MSD DEBUG] ❌ Render error stack:', renderError.stack);
        return { success: false, error: renderError.message, phase: 'advanced_renderer' };
      }

      console.log('[MSD DEBUG] 🎮 Starting renderDebugAndControls()...');
      // CHANGED: Make debug and controls rendering more defensive
      try {
        await systemsManager.renderDebugAndControls(resolvedModel, mountEl);
        console.log('[MSD DEBUG] ✅ renderDebugAndControls() completed successfully');
      } catch (debugControlsError) {
        console.error('[MSD DEBUG] ❌ renderDebugAndControls() FAILED:', debugControlsError);
        console.error('[MSD DEBUG] ❌ Debug/Controls error stack:', debugControlsError.stack);
        // Don't fail the entire render - just log the error
        console.warn('[MSD DEBUG] ⚠️ Continuing without debug/controls rendering due to error');
      }

      const renderTime = performance.now() - startTime;
      console.log(`[MSD DEBUG] ✅ reRender() COMPLETED in ${renderTime.toFixed(2)}ms`);

      return renderResult || { success: true };

    } catch (error) {
      console.error('[MSD DEBUG] ❌ reRender() COMPLETELY FAILED:', error);
      console.error('[MSD DEBUG] ❌ Complete failure stack:', error.stack);
      return { success: false, error: error.message };
    } finally {
      systemsManager._renderInProgress = false;
      console.log('[MSD DEBUG] 🏁 reRender() FINALLY block - _renderInProgress reset to false');
    }
  }

  // Connect reRender callback to systems
  systemsManager.setReRenderCallback(reRender);

  // Initial render - CHANGED: Make async
  console.log('[MSD v1] Computing initial resolved model');
  console.log('[MSD v1] DataSourceManager status:', {
    sourcesCount: systemsManager.dataSourceManager?.getAllSources?.()?.length || 0,
    entityCount: systemsManager.dataSourceManager?.listIds?.()?.length || 0
  });

  const initialRenderResult = await reRender();

  console.log('[MSD v1] Initial render completed:', {
    overlayCount: initialRenderResult?.overlayCount || 0,
    errors: initialRenderResult?.errors || 0
  });

  // Create pipeline API
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
  console.log('[MSD v1] Attaching unified API');
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

  console.log('[MSD v1] Pipeline initialization complete');
  return pipelineApi;
}

function createDisabledPipeline(mergedConfig, issues, provenance) {
  const disabledPipeline = {
    enabled: false,
    errors: issues.errors,
    warnings: issues.warnings,
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
        console.log('[MSD v1] Manual re-render triggered');
        return reRender();
      } catch (error) {
        console.error('[MSD v1] Manual re-render failed:', error);
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
    _reRenderCallback: reRender
  };

  return api;
}

/**
 * Initialize Heads-Up Display (HUD) controller.
 * @param {Object} pipeline
 * @param {HTMLElement|ShadowRoot} mountEl
 * @returns {Promise<void>|null}
 */
export function initMsdHud(pipeline, mountEl) {
  if (!pipeline?.enabled) return null;
  import('../hud/HudController.js').then(mod => {
    const hud = new mod.HudController(pipeline, mountEl);
    hud.refresh();
    if (window.__msdDebug) {
      window.__msdDebug.hud = {
        refresh: () => hud.refresh(),
        hud
      };
    }
  }).catch(err => {
    console.warn('[MSD v1] HudController import failed:', err);
  });
}