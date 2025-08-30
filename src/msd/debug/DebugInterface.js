import { perfGetAll } from '../perf/PerfCounters.js';
import { MsdIntrospection } from '../introspection/MsdIntrospection.js';

export function setupDebugInterface(pipelineApi, mergedConfig, provenance, systemsManager, modelBuilder) {
  if (typeof window === 'undefined') return;

  const dbg = window.__msdDebug = window.__msdDebug || {};

  // Extract debug config from mergedConfig
  const debugConfig = mergedConfig?.debug || {};

  console.log('[MSD Debug Interface] Setting up with config:', debugConfig);

  // Core pipeline access - UNIFIED: Only set pipelineInstance
  dbg.pipelineInstance = pipelineApi;

  // Add backward compatibility getter with deprecation warning
  if (!dbg.hasOwnProperty('pipeline')) {
    Object.defineProperty(dbg, 'pipeline', {
      get() {
        console.warn('[MSD Debug] window.__msdDebug.pipeline is deprecated. Use window.__msdDebug.pipelineInstance instead.');
        return this.pipelineInstance;
      },
      configurable: true
    });
  }

  dbg._provenance = provenance;

  // Routing system
  setupRoutingDebugInterface(dbg, pipelineApi, systemsManager);

  // Data sources - our current entity management system
  setupDataSourceDebugInterface(dbg, systemsManager);

  // Rendering and debug visualization - now with config control
  setupRenderingDebugInterface(dbg, systemsManager, modelBuilder, pipelineApi, debugConfig);

  // Performance and validation
  setupUtilityDebugInterface(dbg, mergedConfig, systemsManager);

  console.log('[MSD v1] Debug interface setup complete');
  console.log('[MSD v1] Available methods:', Object.keys(dbg));

  // Log debug config state
  if (debugConfig.enabled) {
    console.log('[MSD v1] Debug mode enabled:', debugConfig);
  } else {
    console.log('[MSD v1] Debug mode disabled by config');
  }
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
  // ENHANCED: Make this the primary entity access system
  if (!dbg.hasOwnProperty('dataSources')) {
    dbg.dataSources = {
      stats: () => systemsManager.dataSourceManager?.getStats() || { error: 'DataSourceManager not initialized' },
      list: () => systemsManager.dataSourceManager ? Array.from(systemsManager.dataSourceManager.sources.keys()) : [],
      get: (name) => systemsManager.dataSourceManager?.getSource(name)?.getStats() || null,
      dump: () => systemsManager.dataSourceManager?.debugDump() || { error: 'DataSourceManager not initialized' },
      manager: () => systemsManager.dataSourceManager
    };
  } else {
    // If dataSources already exists (from index.js getter), enhance it with additional methods
    try {
      Object.assign(dbg.dataSources, {
        list: () => systemsManager.dataSourceManager ? Array.from(systemsManager.dataSourceManager.sources.keys()) : [],
        get: (name) => systemsManager.dataSourceManager?.getSource(name)?.getStats() || null,
        dump: () => systemsManager.dataSourceManager?.debugDump() || { error: 'DataSourceManager not initialized' }
      });
    } catch (error) {
      // If we can't enhance it (getter-only), create alternative access
      dbg.dataSourcesDebug = {
        stats: () => systemsManager.dataSourceManager?.getStats() || { error: 'DataSourceManager not initialized' },
        list: () => systemsManager.dataSourceManager ? Array.from(systemsManager.dataSourceManager.sources.keys()) : [],
        get: (name) => systemsManager.dataSourceManager?.getSource(name)?.getStats() || null,
        dump: () => systemsManager.dataSourceManager?.debugDump() || { error: 'DataSourceManager not initialized' },
        manager: () => systemsManager.dataSourceManager
      };
      console.log('[DebugInterface] Created dataSourcesDebug as alternative access due to getter conflict');
    }
  }

  // ADDED: Legacy compatibility layer for any remaining entity access patterns
  // This provides entity-like access through DataSourceManager
  dbg.entities = {
    list: () => {
      console.warn('[MSD Debug] entities.list() is deprecated. Use window.__msdDebug.dataSourceManager.listIds() instead.');
      return systemsManager.dataSourceManager?.listIds() || [];
    },
    get: (id) => {
      console.warn('[MSD Debug] entities.get() is deprecated. Use window.__msdDebug.dataSourceManager.getEntity() instead.');
      return systemsManager.dataSourceManager?.getEntity(id) || null;
    },
    stats: () => {
      console.warn('[MSD Debug] entities.stats() is deprecated. Use window.__msdDebug.dataSources.stats() instead.');
      const dsStats = systemsManager.dataSourceManager?.getStats() || {};
      const entityCount = systemsManager.dataSourceManager?.listIds()?.length || 0;

      // Transform DataSourceManager stats to legacy format for compatibility
      return {
        count: entityCount,
        subscribed: Object.keys(dsStats.sources || {}).length,
        updated: Object.values(dsStats.sources || {}).reduce((sum, source) => sum + (source.received || 0), 0),
        cacheHits: Object.values(dsStats.sources || {}).reduce((sum, source) => sum + (source.cacheHits || 0), 0)
      };
    }
  };
}

function setupRenderingDebugInterface(dbg, systemsManager, modelBuilder, pipelineApi, debugConfig) {
  console.log('[MSD Debug Interface] Setting up rendering interface with config:', debugConfig);

  // FIXED: Store shadowRoot context for debug operations
  let debugShadowRoot = null;
  let lastUsedRoot = null;

  /**
   * Store the shadowRoot context from the render call
   * This allows us to find elements within the correct scope later
   */
  function setDebugContext(root) {
    if (root && root.querySelector) {
      debugShadowRoot = root;
      lastUsedRoot = root;
      console.log('[MSD Debug] Stored debug context:', root.constructor.name);
    }
  }

  /**
   * Find MSD wrapper element within the correct scope (shadowRoot)
   */
  function findMsdWrapper() {
    const searchRoots = [debugShadowRoot, lastUsedRoot].filter(Boolean);

    for (const root of searchRoots) {
      if (!root || !root.querySelector) continue;

      // Try multiple selectors within this shadowRoot
      const selectors = [
        '#msd-v1-comprehensive-wrapper',
        '[id*="msd-v1"]',
        '[id*="msd"]',
        '.msd-container',
        'div[style*="border:2px solid cyan"]'  // Fallback to the wrapper div style
      ];

      for (const selector of selectors) {
        try {
          const element = root.querySelector(selector);
          if (element) {
            console.log(`[MSD Debug] Found wrapper using selector '${selector}' in ${root.constructor.name}`);
            return element;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
    }

    console.warn('[MSD Debug] Could not find MSD wrapper in any known shadowRoot');
    return null;
  }

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

  // ENHANCED: Complete debug object with all console methods
  dbg.debug = {
    render: (root, viewBox, options = {}) => {
      console.log('[MSD Debug] render() called with config enabled:', debugConfig?.enabled);

      // FIXED: Store the shadowRoot context for later use
      setDebugContext(root);

      // Check if debug is enabled in config
      if (!debugConfig?.enabled) {
        console.log('[MSD v1] Debug rendering disabled by config - enabled value:', debugConfig?.enabled);
        return;
      }

      try {
        const model = modelBuilder.getResolvedModel();
        if (model) {
          // Create render options based on config
          const renderOptions = {
            ...options,
            // Pass config-based flags to the renderer
            showAnchors: debugConfig?.overlays?.anchors,
            showBoundingBoxes: debugConfig?.overlays?.bounding_boxes,
            showRouting: debugConfig?.overlays?.routing,
            showPerformance: debugConfig?.overlays?.performance,
            // Include model data for rendering
            anchors: options?.anchors || model.anchors || {},
            overlays: model.overlays || []
          };

          console.log('[MSD Debug] Calling debugRenderer.render with options:', renderOptions);

          // The MsdDebugRenderer expects different parameters
          systemsManager.debugRenderer.render(root, viewBox, renderOptions);
        } else {
          console.warn('[MSD v1] debug.render: No resolved model available');
        }
      } catch (error) {
        console.warn('[MSD v1] debug.render failed:', error);
      }
    },

    // Core feature control methods
    enable: (feature) => {
      console.log(`[MSD Debug] Enabling feature: ${feature}`);

      if (!debugConfig.overlays) debugConfig.overlays = {};

      if (feature === 'all') {
        debugConfig.enabled = true;
        debugConfig.overlays.anchors = true;
        debugConfig.overlays.bounding_boxes = true;
        debugConfig.overlays.routing = true;
        debugConfig.overlays.performance = true;
      } else if (['anchors', 'bounding_boxes', 'routing', 'performance'].includes(feature)) {
        debugConfig.enabled = true;
        debugConfig.overlays[feature] = true;
      }

      console.log(`[MSD v1] Debug feature '${feature}' enabled - config now:`, debugConfig);

      // Re-render debug if currently active
      dbg.debug.refresh();
    },

    disable: (feature) => {
      console.log(`[MSD Debug] Disabling feature: ${feature}`);

      if (!debugConfig.overlays) return;

      if (feature === 'all') {
        debugConfig.enabled = false;
        debugConfig.overlays.anchors = false;
        debugConfig.overlays.bounding_boxes = false;
        debugConfig.overlays.routing = false;
        debugConfig.overlays.performance = false;
      } else if (['anchors', 'bounding_boxes', 'routing', 'performance'].includes(feature)) {
        debugConfig.overlays[feature] = false;

        // Disable debug entirely if no features are enabled
        const anyEnabled = Object.values(debugConfig.overlays).some(enabled => enabled);
        if (!anyEnabled) {
          debugConfig.enabled = false;
        }
      }

      console.log(`[MSD v1] Debug feature '${feature}' disabled - config now:`, debugConfig);

      // Re-render debug
      dbg.debug.refresh();
    },

    toggle: (feature) => {
      if (!debugConfig.overlays) debugConfig.overlays = {};

      if (feature === 'all') {
        const currentlyEnabled = debugConfig.enabled;
        if (currentlyEnabled) {
          dbg.debug.disable('all');
        } else {
          dbg.debug.enable('all');
        }
      } else if (['anchors', 'bounding_boxes', 'routing', 'performance'].includes(feature)) {
        const currentlyEnabled = debugConfig.overlays[feature];
        if (currentlyEnabled) {
          dbg.debug.disable(feature);
        } else {
          dbg.debug.enable(feature);
        }
      }
    },

    // FIXED: Force re-render of debug overlays with proper shadowRoot context
    refresh: () => {
      console.log('[MSD Debug] Refreshing debug overlays...');

      setTimeout(() => {
        try {
          // FIXED: Use our shadowRoot-aware wrapper finder
          const wrapper = findMsdWrapper();

          if (wrapper) {
            const model = modelBuilder.getResolvedModel();
            if (model) {
              console.log('[MSD Debug] Found wrapper, calling render with model:', {
                anchorCount: Object.keys(model.anchors || {}).length,
                overlayCount: model.overlays?.length || 0,
                viewBox: model.viewBox,
                wrapperType: wrapper.constructor.name,
                wrapperId: wrapper.id
              });

              // FIXED: Use the shadowRoot context, not the wrapper's parent
              const renderRoot = debugShadowRoot || lastUsedRoot;
              if (renderRoot) {
                dbg.debug.render(renderRoot, model.viewBox, {
                  anchors: model.anchors,
                  overlays: model.overlays
                });
              } else {
                console.warn('[MSD Debug] No stored shadowRoot context for rendering');
              }
            } else {
              console.warn('[MSD Debug] No resolved model available for refresh');
            }
          } else {
            console.warn('[MSD Debug] Could not find MSD wrapper element for refresh');

            // DEBUGGING: Log available elements in known shadowRoots
            [debugShadowRoot, lastUsedRoot].filter(Boolean).forEach((root, index) => {
              if (root && root.querySelectorAll) {
                const allDivs = root.querySelectorAll('div[id]');
                console.log(`[MSD Debug] Available divs with IDs in shadowRoot ${index}:`,
                  Array.from(allDivs).map(div => ({ id: div.id, classes: div.className }))
                );
              }
            });
          }
        } catch (error) {
          console.warn('[MSD v1] Debug refresh failed:', error);
        }
      }, 100);
    },

    status: () => {
      const rendererState = systemsManager.debugRenderer?.getDebugState?.() || {};
      return {
        config: {
          enabled: debugConfig?.enabled || false,
          overlays: debugConfig?.overlays || {},
          console: debugConfig?.console || {},
          hud: debugConfig?.hud || {}
        },
        renderer: rendererState,
        context: {
          hasShadowRoot: Boolean(debugShadowRoot),
          hasLastRoot: Boolean(lastUsedRoot),
          canFindWrapper: Boolean(findMsdWrapper())
        }
      };
    },

    // CONSOLE-ACCESSIBLE NESTED METHODS
    anchors: {
      show: () => {
        console.log('[MSD Debug] Showing anchor markers');
        dbg.debug.enable('anchors');
      },
      hide: () => {
        console.log('[MSD Debug] Hiding anchor markers');
        dbg.debug.disable('anchors');
      },
      toggle: () => {
        console.log('[MSD Debug] Toggling anchor markers');
        dbg.debug.toggle('anchors');
      }
    },

    bounding: {
      show: () => {
        console.log('[MSD Debug] Showing bounding boxes');
        dbg.debug.enable('bounding_boxes');
      },
      hide: () => {
        console.log('[MSD Debug] Hiding bounding boxes');
        dbg.debug.disable('bounding_boxes');
      },
      toggle: () => {
        console.log('[MSD Debug] Toggling bounding boxes');
        dbg.debug.toggle('bounding_boxes');
      }
    },

    routing: {
      show: () => {
        console.log('[MSD Debug] Showing routing guides');
        dbg.debug.enable('routing');
      },
      hide: () => {
        console.log('[MSD Debug] Hiding routing guides');
        dbg.debug.disable('routing');
      },
      toggle: () => {
        console.log('[MSD Debug] Toggling routing guides');
        dbg.debug.toggle('routing');
      }
    },

    performance: {
      show: () => {
        console.log('[MSD Debug] Showing performance overlay');
        dbg.debug.enable('performance');
      },
      hide: () => {
        console.log('[MSD Debug] Hiding performance overlay');
        dbg.debug.disable('performance');
      },
      toggle: () => {
        console.log('[MSD Debug] Toggling performance overlay');
        dbg.debug.toggle('performance');
      }
    }
  };

  // Rest of the function remains the same...
  dbg.hud = {
    show: () => systemsManager.hudManager.show(),
    hide: () => systemsManager.hudManager.hide(),
    toggle: () => systemsManager.hudManager.toggle(),
    state: () => ({
      visible: systemsManager.hudManager.state?.visible || false,
      activePanel: systemsManager.hudManager.state?.activePanel || 'unknown',
      refreshRate: systemsManager.hudManager.state?.refreshRate || 2000
    }),

    init: () => {
      if (debugConfig?.hud?.auto_show) {
        setTimeout(() => {
          systemsManager.hudManager.show();
          console.log('[MSD v1] HUD auto-shown based on config');
        }, 2000);
      }
    }
  };

  setTimeout(() => dbg.hud.init(), 100);

  dbg.introspection = {
    listOverlays: (root) => MsdIntrospection.listOverlays(root),
    getOverlayBBox: (id, root) => MsdIntrospection.getOverlayBBox(id, root),
    highlight: (ids, opts) => MsdIntrospection.highlight(ids, opts)
  };

  dbg.controls = {
    render: (overlays, model) => systemsManager.controlsRenderer.renderControls(overlays, model),
    relayout: () => systemsManager.controlsRenderer.relayout()
  };

  console.log('[MSD Debug Interface] Rendering interface setup complete, debug methods created');
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