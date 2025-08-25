import { MSD_V1_ENABLE } from '../featureFlags.js';
import { perfGetAll } from '../perf/PerfCounters.js';
import { MsdIntrospection } from '../introspection/MsdIntrospection.js';

export function setupDebugInterface(pipelineApi, mergedConfig, provenance, systemsManager, modelBuilder) {
  if (typeof window === 'undefined') return;

  const dbg = window.__msdDebug = window.__msdDebug || {};

  // Feature flags
  dbg.featureFlags = dbg.featureFlags || {};
  dbg.featureFlags.MSD_V1_ENABLE = MSD_V1_ENABLE;

  // Core pipeline access
  dbg.pipelineInstance = pipelineApi;
  dbg.pipeline = {
    merged: mergedConfig,
    cardModel: pipelineApi.cardModel,
    rulesEngine: systemsManager.rulesEngine,
    router: systemsManager.router
  };
  dbg._provenance = provenance;

  // Entity system
  setupEntityDebugInterface(dbg, systemsManager);

  // Routing system
  setupRoutingDebugInterface(dbg, pipelineApi, systemsManager);

  // Data sources
  setupDataSourceDebugInterface(dbg, systemsManager);

  // Rendering and debug visualization
  setupRenderingDebugInterface(dbg, systemsManager, modelBuilder, pipelineApi);

  // Performance and validation
  setupUtilityDebugInterface(dbg, mergedConfig, systemsManager);

  console.log('[MSD v1] Debug interface setup complete');
  console.log('[MSD v1] Available methods:', Object.keys(dbg));
}

function setupEntityDebugInterface(dbg, systemsManager) {
  dbg.entities = {
    list: () => {
      try {
        return systemsManager.entityRuntime?.listIds?.() || [];
      } catch (e) {
        console.warn('[MSD v1] entities.list failed:', e);
        return [];
      }
    },
    get: (id) => {
      try {
        return systemsManager.entityRuntime?.getEntity?.(id) || null;
      } catch (e) {
        console.warn(`[MSD v1] entities.get(${id}) failed:`, e);
        return null;
      }
    },
    stats: () => {
      try {
        const runtimeStats = systemsManager.entityRuntime?.stats?.() || {};
        const entityCount = systemsManager.entityRuntime?.listIds?.()?.length || 0;
        return {
          count: entityCount,
          subscribed: runtimeStats.subscribed || 0,
          updated: runtimeStats.updated || 0,
          cacheHits: runtimeStats.cacheHits || 0,
          ...runtimeStats
        };
      } catch (e) {
        console.warn('[MSD v1] entities.stats failed:', e);
        return { count: 0, subscribed: 0, updated: 0, error: e.message };
      }
    },
    ingest: (statesObj) => {
      try {
        console.log('[MSD v1] Manual entity ingestion:', Object.keys(statesObj || {}).length, 'entities');
        return systemsManager.entityRuntime?.ingestHassStates?.(statesObj || {});
      } catch (e) {
        console.warn('[MSD v1] entities.ingest failed:', e);
      }
    },
    testIngestion: () => {
      const testStates = {
        'sensor.test_entity': {
          state: '42',
          attributes: { unit: 'test' },
          last_changed: new Date().toISOString(),
          last_updated: new Date().toISOString()
        }
      };
      console.log('[MSD v1] Testing entity ingestion...');
      systemsManager.entityRuntime.ingestHassStates(testStates);
      const result = systemsManager.entityRuntime.getEntity('sensor.test_entity');
      console.log('[MSD v1] Test result:', result);
      return result;
    }
  };

  dbg.updateEntities = (map) => systemsManager.updateEntities(map);
}

function setupRoutingDebugInterface(dbg, pipelineApi, systemsManager) {
  dbg.routing = {
    inspect: (id) => pipelineApi.routingInspect(id),
    invalidate: (id='*') => systemsManager.router.invalidate(id),
    stats: () => {
      try {
        return systemsManager.router.stats?.() || { cacheHits: 0, pathsComputed: 0, invalidations: 0 };
      } catch (e) {
        console.warn('[MSD v1] routing.stats failed:', e);
        return { cacheHits: 0, pathsComputed: 0, invalidations: 0, error: e.message };
      }
    },
    inspectAs: (id, modeFull='smart') => {
      try {
        const model = pipelineApi.getResolvedModel?.();
        if (!model) return null;
        const ov = model.overlays.find(o => o.id === id);
        if (!ov) return null;
        ov._raw = ov._raw || {};
        const original = ov._raw.route_mode_full;
        ov._raw.route_mode_full = modeFull;
        systemsManager.router.invalidate && systemsManager.router.invalidate('*');
        const res = dbg.routing.inspect(id);
        ov._raw.route_mode_full = original;
        systemsManager.router.invalidate && systemsManager.router.invalidate('*');
        return res;
      } catch (e) {
        console.warn('[MSD v1] inspectAs failed', e);
        return null;
      }
    }
  };
}

function setupDataSourceDebugInterface(dbg, systemsManager) {
  dbg.dataSources = {
    stats: () => systemsManager.dataSourceManager?.getStats() || { error: 'DataSourceManager not initialized' },
    list: () => systemsManager.dataSourceManager ? Array.from(systemsManager.dataSourceManager.sources.keys()) : [],
    get: (name) => systemsManager.dataSourceManager?.getSource(name)?.getStats() || null,
    dump: () => systemsManager.dataSourceManager?.debugDump() || { error: 'DataSourceManager not initialized' },
    manager: () => systemsManager.dataSourceManager
  };
}

function setupRenderingDebugInterface(dbg, systemsManager, modelBuilder, pipelineApi) {
  dbg.renderAdvanced = (options) => {
    try {
      console.log('[MSD v1] renderAdvanced called - using AdvancedRenderer');
      const model = modelBuilder.getResolvedModel();
      if (model) {
        return systemsManager.renderer.render(model);
      }
      console.warn('[MSD v1] renderAdvanced: No resolved model available');
      return { svgMarkup: '' };
    } catch (error) {
      console.error('[MSD v1] renderAdvanced failed:', error);
      return { svgMarkup: '', error: error.message };
    }
  };

  dbg.debug = {
    render: (root, viewBox, options) => {
      try {
        const model = modelBuilder.getResolvedModel();
        if (model) {
          systemsManager.debugRenderer.render(root, viewBox, {
            anchors: options?.anchors || model.anchors || {}
          });
        } else {
          console.warn('[MSD v1] debug.render: No resolved model available');
        }
      } catch (error) {
        console.warn('[MSD v1] debug.render failed:', error);
      }
    }
  };

  dbg.hud = {
    show: () => systemsManager.hudManager.show(),
    hide: () => systemsManager.hudManager.hide(),
    toggle: () => systemsManager.hudManager.toggle(),
    state: () => ({
      visible: systemsManager.hudManager.state?.visible || false,
      activePanel: systemsManager.hudManager.state?.activePanel || 'unknown',
      refreshRate: systemsManager.hudManager.state?.refreshRate || 2000
    })
  };

  dbg.introspection = {
    listOverlays: (root) => MsdIntrospection.listOverlays(root),
    getOverlayBBox: (id, root) => MsdIntrospection.getOverlayBBox(id, root),
    highlight: (ids, opts) => MsdIntrospection.highlight(ids, opts)
  };

  dbg.controls = {
    render: (overlays, model) => systemsManager.controlsRenderer.renderControls(overlays, model),
    relayout: () => systemsManager.controlsRenderer.relayout()
  };
}

function setupUtilityDebugInterface(dbg, mergedConfig, systemsManager) {
  // Rules system
  dbg.rules = {
    trace: () => systemsManager.rulesEngine.getTrace()
  };

  // Animations
  dbg.animations = {
    active: () => systemsManager.animRegistry.getActive()
  };

  // Performance monitoring
  dbg.getPerf = () => {
    const perfStore = dbg.__perfStore || {};
    const result = {
      timers: {},
      counters: perfStore.counters || {}
    };

    if (perfStore.timings) {
      Object.entries(perfStore.timings).forEach(([key, data]) => {
        if (data && typeof data === 'object') {
          result.timers[key] = {
            count: data.count || 0,
            total: data.total || 0,
            avg: data.count > 0 ? (data.total / data.count) : 0,
            last: data.last || 0,
            max: data.max || 0
          };
        }
      });
    }

    return result;
  };

  dbg.perf = () => perfGetAll();

  // Validation
  dbg.validation = {
    issues: () => {
      try {
        return mergedConfig.__issues || { errors: [], warnings: [] };
      } catch (e) {
        console.warn('[MSD v1] validation.issues failed:', e);
        return { errors: [], warnings: [] };
      }
    }
  };

  // Packs inspection
  dbg.packs = {
    list: (type) => {
      if (!type) return {
        animations: mergedConfig.animations?.length || 0,
        overlays: mergedConfig.overlays?.length || 0,
        rules: mergedConfig.rules?.length || 0,
        profiles: mergedConfig.profiles?.length || 0,
        timelines: mergedConfig.timelines?.length || 0
      };
      return mergedConfig[type] || [];
    },
    get: (type,id) => (mergedConfig[type]||[]).find(i=>i.id===id),
    issues: () => mergedConfig.__issues
  };

  // Line debugging
  dbg.lines = {
    markersEnabled: false,
    showMarkers(flag=true){
      this.markersEnabled=!!flag;
      console.info('[MSD v1] line endpoint markers', this.markersEnabled?'ENABLED':'DISABLED');
    },
    forceRedraw: () => {
      // Connect to the reRender callback through systems manager
      if (systemsManager._reRenderCallback) {
        systemsManager._reRenderCallback();
        return true;
      }
      return false;
    }
  };
}
