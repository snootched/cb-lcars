import { perfGetAll } from '../perf/PerfCounters.js';
import { MsdIntrospection } from '../introspection/MsdIntrospection.js';

export function setupDebugInterface(pipelineApi, mergedConfig, provenance, systemsManager, modelBuilder) {
  if (typeof window === 'undefined') return;

  const dbg = window.__msdDebug = window.__msdDebug || {};

  // Extract debug config from mergedConfig
  const debugConfig = mergedConfig?.debug || {};

  // REDUCED: Minimal startup logging
  console.log('[MSD v1] Debug interface ready - type window.__msdDebug.help() for usage');

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

  // Log debug config state (REDUCED)
  if (debugConfig.enabled) {
    console.log('[MSD v1] Debug mode enabled');
  }
}

// ...existing code...

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
  // REDUCED: Minimal setup logging
  const debugManager = systemsManager.debugManager;

  // Enhanced debug object powered by DebugManager
  dbg.debug = {
    // Core feature control methods using DebugManager
    enable: (feature) => {
      if (feature === 'all') {
        debugManager.enableMultiple(['anchors', 'bounding_boxes', 'routing', 'performance']);
      } else {
        debugManager.enable(feature);
      }

      // FIXED: More aggressive re-render after enabling with proper timing
      setTimeout(() => {
        try {
          const pipelineInstance = window.__msdDebug?.pipelineInstance;
          if (pipelineInstance?.reRender) {
            console.log('[MSD Debug] Force re-render after enable:', feature);
            pipelineInstance.reRender();
          }
        } catch (error) {
          console.warn('[MSD Debug] Failed to trigger re-render:', error);
        }
      }, 10);
    },

    disable: (feature) => {
      if (feature === 'all') {
        debugManager.disableMultiple(['anchors', 'bounding_boxes', 'routing', 'performance']);
      } else {
        debugManager.disable(feature);
      }

      // FIXED: More aggressive re-render after disabling with proper timing
      setTimeout(() => {
        try {
          const pipelineInstance = window.__msdDebug?.pipelineInstance;
          if (pipelineInstance?.reRender) {
            console.log('[MSD Debug] Force re-render after disable:', feature);
            pipelineInstance.reRender();
          }
        } catch (error) {
          console.warn('[MSD Debug] Failed to trigger re-render:', error);
        }
      }, 10);
    },

    // Manual debug render test
    testRender: () => {
      console.log('[MSD Debug] Testing debug render directly...');
      try {
        const debugState = debugManager.getSnapshot();
        console.log('[MSD Debug] Current state:', debugState);

        // Get pipeline instance to access the shadowRoot context
        const pipelineInstance = window.__msdDebug?.pipelineInstance;
        if (!pipelineInstance) {
          console.warn('[MSD Debug] No pipeline instance available');
          return;
        }

        // Try to get the shadowRoot from the systems manager
        const systemsManager = pipelineInstance.systemsManager;
        if (!systemsManager) {
          console.warn('[MSD Debug] No systems manager available');
          return;
        }

        // Use the renderer's mount element (shadowRoot)
        const mountEl = systemsManager.renderer?.mountEl;
        if (!mountEl) {
          console.warn('[MSD Debug] No mount element found in renderer');
          return;
        }

        console.log('[MSD Debug] Found mount element:', mountEl.constructor.name);

        // Get resolved model for proper context
        const resolvedModel = pipelineInstance.getResolvedModel();
        if (!resolvedModel) {
          console.warn('[MSD Debug] No resolved model available');
          return;
        }

        console.log('[MSD Debug] Calling renderDebugAndControls with shadowRoot context');
        systemsManager.renderDebugAndControls(resolvedModel, mountEl);

      } catch (error) {
        console.error('[MSD Debug] testRender failed:', error);
      }
    },

    // Scale control via DebugManager
    setScale: (scale) => debugManager.setScale(scale),

    // Status from DebugManager - FIXED: Use silent method by default
    status: () => {
      const state = debugManager.getSnapshot();
      console.table(state);
      return state;
    },

    // ADDED: Silent status access for programmatic use
    getStatus: () => debugManager.getSnapshot(),

    // Subscribe to DebugManager changes
    onChange: (callback) => debugManager.onChange(callback),

    // Manual refresh triggers re-render
    refresh: () => {
      try {
        const pipelineInstance = window.__msdDebug?.pipelineInstance;
        if (pipelineInstance?.reRender) {
          pipelineInstance.reRender();
          console.log('[MSD Debug] Debug overlays refreshed');
        }
      } catch (error) {
        console.warn('[MSD Debug] Failed to trigger pipeline re-render:', error);
      }
    },

    // Convenient nested methods using DebugManager
    anchors: {
      show: () => debugManager.enable('anchors'),
      hide: () => debugManager.disable('anchors'),
      toggle: () => debugManager.toggle('anchors')
    },

    bounding: {
      show: () => debugManager.enable('bounding_boxes'),
      hide: () => debugManager.disable('bounding_boxes'),
      toggle: () => debugManager.toggle('bounding_boxes'),
      // ADDED: Test bounding box accuracy for specific overlay
      test: (overlayId) => {
        const pipelineInstance = window.__msdDebug?.pipelineInstance;
        if (!pipelineInstance) {
          console.warn('[MSD Debug] No pipeline instance available');
          return null;
        }

        const model = pipelineInstance.getResolvedModel?.();
        if (!model) {
          console.warn('[MSD Debug] No resolved model available');
          return null;
        }

        const overlay = model.overlays.find(o => o.id === overlayId);
        if (!overlay) {
          console.warn(`[MSD Debug] Overlay "${overlayId}" not found`);
          return null;
        }

        // Get the debug renderer from systems manager
        const debugRenderer = systemsManager.debugRenderer;
        if (!debugRenderer) {
          console.warn('[MSD Debug] Debug renderer not available');
          return null;
        }

        const position = overlay.position;
        if (!position || !Array.isArray(position)) {
          console.warn(`[MSD Debug] Invalid position for overlay "${overlayId}"`);
          return null;
        }

        const [x, y] = position;
        const dimensions = debugRenderer._getOverlayDimensions(overlay, x, y);

        console.log(`[MSD Debug] Bounding box test for "${overlayId}":`, {
          overlay: {
            id: overlay.id,
            type: overlay.type,
            position: [x, y]
          },
          calculatedDimensions: dimensions,
          overlayConfig: {
            text: overlay.text || overlay.content || overlay._raw?.content,
            style: overlay.finalStyle || overlay.style
          }
        });

        return dimensions;
      },
      // ADDED: Compare bounding box calculation methods
      compare: (overlayId) => {
        const pipelineInstance = window.__msdDebug?.pipelineInstance;
        if (!pipelineInstance) {
          console.warn('[MSD Debug] No pipeline instance available');
          return null;
        }

        const model = pipelineInstance.getResolvedModel?.();
        if (!model) {
          console.warn('[MSD Debug] No resolved model available');
          return null;
        }

        const overlay = model.overlays.find(o => o.id === overlayId);
        if (!overlay || overlay.type !== 'text') {
          console.warn(`[MSD Debug] Text overlay "${overlayId}" not found`);
          return null;
        }

        const [x, y] = overlay.position || [0, 0];
        const debugRenderer = systemsManager.debugRenderer;

        const results = {
          overlayId,
          position: [x, y],
          methods: {}
        };

        // Method 1: Debug renderer calculation
        if (debugRenderer) {
          try {
            const debugDims = debugRenderer._getOverlayDimensions(overlay, x, y);
            results.methods.debugRenderer = debugDims;
          } catch (error) {
            results.methods.debugRenderer = { error: error.message };
          }
        }

        // Method 2: TextOverlayRenderer computation
        try {
          const container = systemsManager.renderer?.mountEl;
          const attachmentData = window.cblcars?.TextOverlayRenderer?.computeAttachmentPoints?.(
            overlay,
            model.anchors || {},
            container
          );
          if (attachmentData?.bbox) {
            results.methods.textOverlayRenderer = {
              x: attachmentData.bbox.left,
              y: attachmentData.bbox.top,
              width: attachmentData.bbox.width,
              height: attachmentData.bbox.height
            };
          }
        } catch (error) {
          results.methods.textOverlayRenderer = { error: error.message };
        }

        // Method 3: DOM getBBox (if rendered)
        try {
          const container = systemsManager.renderer?.mountEl;
          const svgElement = container?.querySelector('svg');
          const renderedElement = svgElement?.querySelector(`[data-overlay-id="${overlayId}"]`);
          if (renderedElement) {
            const bbox = renderedElement.getBBox();
            results.methods.domGetBBox = {
              x: bbox.x,
              y: bbox.y,
              width: bbox.width,
              height: bbox.height
            };
          }
        } catch (error) {
          results.methods.domGetBBox = { error: error.message };
        }

        // Method 4: Data attributes (if set by TextOverlayRenderer)
        try {
          const container = systemsManager.renderer?.mountEl;
          const svgElement = container?.querySelector('svg');
          const renderedElement = svgElement?.querySelector(`[data-overlay-id="${overlayId}"]`);
          if (renderedElement) {
            const width = renderedElement.getAttribute('data-text-width');
            const height = renderedElement.getAttribute('data-text-height');
            const fontSize = renderedElement.getAttribute('data-font-size');
            const dominantBaseline = renderedElement.getAttribute('data-dominant-baseline');
            const textAnchor = renderedElement.getAttribute('data-text-anchor');

            if (width && height) {
              // Use proper baseline calculation like the debug renderer
              let adjustedY = y;
              const textHeight = parseFloat(height);
              const textFontSize = parseFloat(fontSize) || 16;
              const actualBaseline = dominantBaseline || 'auto';

              if (actualBaseline === 'hanging') {
                adjustedY = y;
              } else if (actualBaseline === 'middle' || actualBaseline === 'central') {
                adjustedY = y - textHeight / 2;
              } else if (actualBaseline === 'text-after-edge') {
                adjustedY = y - textHeight;
              } else {
                const ascent = textFontSize * 0.7;
                adjustedY = y - ascent;
              }

              // Also calculate X position based on text anchor
              let adjustedX = x;
              const textWidth = parseFloat(width);
              const actualTextAnchor = textAnchor || 'start';

              if (actualTextAnchor === 'middle') {
                adjustedX = x - textWidth / 2;
              } else if (actualTextAnchor === 'end') {
                adjustedX = x - textWidth;
              }

              results.methods.dataAttributes = {
                x: adjustedX,
                y: adjustedY,
                width: textWidth,
                height: textHeight,
                baseline: actualBaseline,
                anchor: actualTextAnchor
              };
            }
          }
        } catch (error) {
          results.methods.dataAttributes = { error: error.message };
        }        console.table(results.methods);
        return results;
      }
    },

    routing: {
      show: () => debugManager.enable('routing'),
      hide: () => debugManager.disable('routing'),
      toggle: () => debugManager.toggle('routing')
    },

    performance: {
      show: () => debugManager.enable('performance'),
      hide: () => debugManager.disable('performance'),
      toggle: () => debugManager.toggle('performance')
    }
  };

  /*
  // Keep the shadowRoot tracking code - it's still used by testRender and other methods
  let debugShadowRoot = null;
  let lastUsedRoot = null;
  */

  /**
   * Store the shadowRoot context from the render call
   * This allows us to find elements within the correct scope later
   */
  /*
  function setDebugContext(root) {
    if (root && root.querySelector) {
      debugShadowRoot = root;
      lastUsedRoot = root;
      console.log('[MSD Debug] Stored debug context:', root.constructor.name);
    }
  }
  */
  /**
   * Find MSD wrapper element within the correct scope (shadowRoot)
   */
  /*
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
  */

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

  // ADD: Help system
  dbg.help = function() {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                          MSD Debug Interface Help                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Debug Features:                                                              ║
║   __msdDebug.debug.enable('anchors')       - Show anchor point markers      ║
║   __msdDebug.debug.enable('bounding_boxes') - Show overlay bounding boxes   ║
║   __msdDebug.debug.enable('routing')       - Show routing path visualization║
║   __msdDebug.debug.enable('performance')   - Show performance metrics       ║
║   __msdDebug.debug.enable('all')           - Enable all features            ║
║                                                                              ║
║   __msdDebug.debug.disable('feature')      - Disable specific feature       ║
║   __msdDebug.debug.status()                - Show current debug state       ║
║   __msdDebug.debug.setScale(1.5)           - Set debug element scale        ║
║   __msdDebug.debug.refresh()               - Force re-render debug overlays ║
║                                                                              ║
║ Quick Access:                                                                ║
║   __msdDebug.debug.anchors.toggle()        - Toggle anchor markers          ║
║   __msdDebug.debug.bounding.toggle()       - Toggle bounding boxes          ║
║   __msdDebug.debug.bounding.test('id')     - Test bounding box accuracy     ║
║   __msdDebug.debug.bounding.compare('id')  - Compare measurement methods    ║
║   __msdDebug.debug.routing.toggle()        - Toggle routing guides          ║
║   __msdDebug.debug.performance.toggle()    - Toggle performance overlay     ║
║                                                                              ║
║ Data & Entities:                                                             ║
║   __msdDebug.dataSources.stats()           - Data source statistics         ║
║   __msdDebug.dataSources.list()            - List all data sources          ║
║   __msdDebug.dataSources.get('name')       - Get specific data source       ║
║                                                                              ║
║ Routing:                                                                     ║
║   __msdDebug.routing.inspect('overlay_id') - Inspect routing path           ║
║   __msdDebug.routing.stats()               - Routing system statistics      ║
║   __msdDebug.routing.invalidate()          - Clear routing cache            ║
║                                                                              ║
║ Performance:                                                                 ║
║   __msdDebug.getPerf()                     - Get performance metrics        ║
║   __msdDebug.perf()                        - Alternative performance data   ║
║                                                                              ║
║ Other Tools:                                                                 ║
║   __msdDebug.hud.toggle()                  - Toggle HUD overlay             ║
║   __msdDebug.rules.trace()                 - Show rules engine trace        ║
║   __msdDebug.validation.issues()           - Show configuration issues      ║
║   __msdDebug.usage()                       - Show simplified usage examples ║
║                                                                              ║
║ Pipeline:                                                                    ║
║   __msdDebug.pipelineInstance              - Direct pipeline access         ║
╚══════════════════════════════════════════════════════════════════════════════╝
    `);
  };

  // ADD: Simplified usage examples
  dbg.usage = function() {
    console.log(`
🔧 Quick MSD Debug Commands:

Enable debug features:
  __msdDebug.debug.enable('anchors')      # Show anchor points
  __msdDebug.debug.enable('bounding_boxes') # Show overlay bounds
  __msdDebug.debug.enable('all')          # Enable everything

Check status:
  __msdDebug.debug.status()               # Current debug state
  __msdDebug.dataSources.stats()          # Data source info
  __msdDebug.getPerf()                    # Performance metrics

Quick toggles:
  __msdDebug.debug.anchors.toggle()       # Toggle anchors
  __msdDebug.debug.bounding.toggle()      # Toggle bounding boxes
  __msdDebug.debug.bounding.test('id')    # Test bounding accuracy
  __msdDebug.debug.routing.toggle()       # Toggle routing guides

For full help: __msdDebug.help()
    `);
  };

  // Log debug config state (REDUCED)
  if (debugConfig.enabled) {
    console.log('[MSD v1] Debug mode enabled');
  }
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