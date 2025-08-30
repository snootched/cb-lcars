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

  // Initialize model builder
  const modelBuilder = new ModelBuilder(mergedConfig, cardModel, systemsManager);

  // Create render function
  function reRender() {
    const startTime = performance.now();
    const resolvedModel = modelBuilder.computeResolvedModel();

    console.log(`[MSD v1] Re-rendering with AdvancedRenderer - overlays: ${resolvedModel.overlays.length}`);
    const renderResult = systemsManager.renderer.render(resolvedModel);

    // Render debug and controls if needed
    systemsManager.renderDebugAndControls(resolvedModel);

    const renderTime = performance.now() - startTime;
    console.log(`[MSD v1] Render completed in ${renderTime.toFixed(2)}ms`);

    return renderResult;
  }

  // Connect reRender callback to systems
  systemsManager.setReRenderCallback(reRender);

  // Initial render
  console.log('[MSD v1] Computing initial resolved model');
  console.log('[MSD v1] DataSourceManager status:', {
    sourcesCount: systemsManager.dataSourceManager?.getAllSources?.()?.length || 0,
    entityCount: systemsManager.dataSourceManager?.listIds?.()?.length || 0
  });

  const initialRenderResult = reRender();

  console.log('[MSD v1] Initial render completed:', {
    overlayCount: initialRenderResult?.overlayCount || 0,
    errors: initialRenderResult?.errors || 0
  });

  // Create pipeline API
  const pipelineApi = createPipelineApi(
    mergedConfig, cardModel, systemsManager, modelBuilder, reRender
  );

  // Setup debug interface
  setupDebugInterface(pipelineApi, mergedConfig, provenance, systemsManager, modelBuilder);

  // Attach unified API
  console.log('[MSD v1] Attaching unified API');
  MsdApi.attach();

  // Set up debug tracking
  if (window.__msdDebug) {
    // Store reference to systems for debugging
    window.__msdDebug.systemsManager = systemsManager;

    window.__msdDebug.validation = { issues: () => mergedConfig.__issues };
    window.__msdDebug.pipelineInstance = pipelineApi;

    window.__msdDebug._provenance = provenance;
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

function createPipelineApi(mergedConfig, cardModel, systemsManager, modelBuilder, reRender) {
  const api = {
    // Core properties
    enabled: true,
    version: mergedConfig.version || 1,
    config: mergedConfig,

    // Core systems - ENSURE DataSourceManager is exposed
    systemsManager,
    dataSourceManager: systemsManager.dataSourceManager, // ADDED: Direct access
    rulesEngine: systemsManager.rulesEngine,
    renderer: systemsManager.renderer,
    router: systemsManager.router,

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

    // Enhanced debugging - make DataSourceManager easily accessible
    getDataSourceManager: () => systemsManager.dataSourceManager,
  };

  return api;
}

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
