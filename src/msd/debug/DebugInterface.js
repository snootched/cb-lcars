import { perfGetAll } from '../perf/PerfCounters.js';
import { MsdIntrospection } from '../introspection/MsdIntrospection.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { ChartDataValidator } from '../validation/ChartDataValidator.js';

/**
 * ✅ PHASE 4: Setup deprecation warnings for legacy methods
 * Wraps legacy methods with deprecation warnings that guide users to new API.
 * Non-breaking: Old methods still work, but log helpful migration messages.
 *
 * @param {Object} dbg - Debug interface object (window.cblcars.debug.msd)
 */
function setupDeprecationWarnings(dbg) {
  // Store original implementations before wrapping
  const originalMethods = {
    getPerf: dbg.getPerf,
    getPerformanceSummary: dbg.getPerformanceSummary,
    getSlowestOverlays: dbg.getSlowestOverlays,
    getRendererPerformance: dbg.getRendererPerformance,
    getOverlayPerformance: dbg.getOverlayPerformance,
    getPerformanceWarnings: dbg.getPerformanceWarnings,
    getRenderTimeline: dbg.getRenderTimeline,
    compareRendererPerformance: dbg.compareRendererPerformance,
    getStyleResolutions: dbg.getStyleResolutions,
    findOverlaysByToken: dbg.findOverlaysByToken,
    getGlobalStyleSummary: dbg.getGlobalStyleSummary
  };

  // Wrap getPerf -> perf.summary()
  dbg.getPerf = function() {
    cblcarsLog.warn('[DebugInterface] ⚠️ getPerf() is DEPRECATED. Use window.cblcars.debug.msd.perf.summary() instead.');
    cblcarsLog.info('[DebugInterface] Migration: window.cblcars.debug.msd.perf.summary()');
    return dbg.perf?.summary?.() || originalMethods.getPerf?.();
  };

  // Wrap getPerformanceSummary -> perf.summary()
  dbg.getPerformanceSummary = function() {
    cblcarsLog.warn('[DebugInterface] ⚠️ getPerformanceSummary() is DEPRECATED. Use window.cblcars.debug.msd.perf.summary() instead.');
    cblcarsLog.info('[DebugInterface] Migration: window.cblcars.debug.msd.perf.summary()');
    return dbg.perf?.summary?.() || originalMethods.getPerformanceSummary?.();
  };

  // Wrap getSlowestOverlays -> perf.slowestOverlays()
  dbg.getSlowestOverlays = function(count = 5) {
    cblcarsLog.warn('[DebugInterface] ⚠️ getSlowestOverlays() is DEPRECATED. Use window.cblcars.debug.msd.perf.slowestOverlays() instead.');
    cblcarsLog.info('[DebugInterface] Migration: window.cblcars.debug.msd.perf.slowestOverlays(' + count + ')');
    return dbg.perf?.slowestOverlays?.(count) || originalMethods.getSlowestOverlays?.(count);
  };

  // Wrap getRendererPerformance -> perf.byRenderer()
  dbg.getRendererPerformance = function() {
    cblcarsLog.warn('[DebugInterface] ⚠️ getRendererPerformance() is DEPRECATED. Use window.cblcars.debug.msd.perf.byRenderer() instead.');
    cblcarsLog.info('[DebugInterface] Migration: window.cblcars.debug.msd.perf.byRenderer()');
    return dbg.perf?.byRenderer?.() || originalMethods.getRendererPerformance?.();
  };

  // Wrap getOverlayPerformance -> perf.byOverlay()
  dbg.getOverlayPerformance = function(overlayId) {
    cblcarsLog.warn('[DebugInterface] ⚠️ getOverlayPerformance() is DEPRECATED. Use window.cblcars.debug.msd.perf.byOverlay() instead.');
    cblcarsLog.info('[DebugInterface] Migration: window.cblcars.debug.msd.perf.byOverlay("' + overlayId + '")');
    return dbg.perf?.byOverlay?.(overlayId) || originalMethods.getOverlayPerformance?.(overlayId);
  };

  // Wrap getPerformanceWarnings -> perf.warnings()
  dbg.getPerformanceWarnings = function() {
    cblcarsLog.warn('[DebugInterface] ⚠️ getPerformanceWarnings() is DEPRECATED. Use window.cblcars.debug.msd.perf.warnings() instead.');
    cblcarsLog.info('[DebugInterface] Migration: window.cblcars.debug.msd.perf.warnings()');
    return dbg.perf?.warnings?.() || originalMethods.getPerformanceWarnings?.();
  };

  // Wrap getRenderTimeline -> perf.timeline()
  dbg.getRenderTimeline = function() {
    cblcarsLog.warn('[DebugInterface] ⚠️ getRenderTimeline() is DEPRECATED. Use window.cblcars.debug.msd.perf.timeline() instead.');
    cblcarsLog.info('[DebugInterface] Migration: window.cblcars.debug.msd.perf.timeline()');
    return dbg.perf?.timeline?.() || originalMethods.getRenderTimeline?.();
  };

  // Wrap compareRendererPerformance -> perf.compare()
  dbg.compareRendererPerformance = function() {
    cblcarsLog.warn('[DebugInterface] ⚠️ compareRendererPerformance() is DEPRECATED. Use window.cblcars.debug.msd.perf.compare() instead.');
    cblcarsLog.info('[DebugInterface] Migration: window.cblcars.debug.msd.perf.compare()');
    cblcarsLog.info('[DebugInterface] Note: perf.compare() returns NOT_IMPLEMENTED - planned for Phase 5');
    return dbg.perf?.compare?.() || originalMethods.compareRendererPerformance?.();
  };

  // Wrap getStyleResolutions -> styles.resolutions()
  dbg.getStyleResolutions = function(overlayId) {
    cblcarsLog.warn('[DebugInterface] ⚠️ getStyleResolutions() is DEPRECATED. Use window.cblcars.debug.msd.styles.resolutions() instead.');
    cblcarsLog.info('[DebugInterface] Migration: window.cblcars.debug.msd.styles.resolutions("' + overlayId + '")');
    return dbg.styles?.resolutions?.(overlayId) || originalMethods.getStyleResolutions?.(overlayId);
  };

  // Wrap findOverlaysByToken -> styles.findByToken()
  dbg.findOverlaysByToken = function(tokenPath) {
    cblcarsLog.warn('[DebugInterface] ⚠️ findOverlaysByToken() is DEPRECATED. Use window.cblcars.debug.msd.styles.findByToken() instead.');
    cblcarsLog.info('[DebugInterface] Migration: window.cblcars.debug.msd.styles.findByToken("' + tokenPath + '")');
    return dbg.styles?.findByToken?.(tokenPath) || originalMethods.findOverlaysByToken?.(tokenPath);
  };

  // Wrap getGlobalStyleSummary -> styles.provenance()
  dbg.getGlobalStyleSummary = function() {
    cblcarsLog.warn('[DebugInterface] ⚠️ getGlobalStyleSummary() is DEPRECATED. Use window.cblcars.debug.msd.styles.provenance() instead.');
    cblcarsLog.info('[DebugInterface] Migration: window.cblcars.debug.msd.styles.provenance()');
    return dbg.styles?.provenance?.() || originalMethods.getGlobalStyleSummary?.();
  };

  cblcarsLog.debug('[DebugInterface] ✅ Phase 4 deprecation warnings installed (11 legacy methods wrapped)');
}

export function setupDebugInterface(pipelineApi, mergedConfig, provenance, systemsManager, modelBuilder) {
  if (typeof window === 'undefined') return;

  // ✅ PHASE 3: Updated to use window.cblcars.debug.msd namespace
  // CRITICAL: Do NOT reassign window.cblcars.debug.msd, just ensure it exists
  window.cblcars = window.cblcars || {};
  window.cblcars.debug = window.cblcars.debug || {};
  window.cblcars.debug.msd = window.cblcars.debug.msd || {};

  // Reference the existing namespace (do NOT reassign it)
  const dbg = window.cblcars.debug.msd;

  // ✅ PHASE 3: Add backward compatibility shim for window.__msdDebug
  if (!window.__msdDebug) {
    Object.defineProperty(window, '__msdDebug', {
      get() {
        console.warn('⚠️ [DebugInterface] window.__msdDebug is DEPRECATED.');
        console.warn('   Use window.cblcars.debug.msd instead.');
        console.warn('   Migration guide: https://github.com/CB-LCARS/cb-lcars/blob/dev-animejs/doc/api/MIGRATION_GUIDE.md');
        return window.cblcars.debug.msd;
      },
      set(value) {
        console.warn('⚠️ [DebugInterface] Setting window.__msdDebug is DEPRECATED. Use window.cblcars.debug.msd instead.');
        window.cblcars.debug.msd = value;
      },
      configurable: true
    });
  }

  // Extract debug config from mergedConfig
  const debugConfig = mergedConfig?.debug || {};

  // REDUCED: Minimal startup logging
  cblcarsLog.debug('[DebugInterface] 🛠️ Debug interface ready - type window.cblcars.debug.msd.help() for usage');

  // Core pipeline access - UNIFIED: Only set pipelineInstance
  dbg.pipelineInstance = pipelineApi;

  // Add backward compatibility getter with deprecation warning
  if (!dbg.hasOwnProperty('pipeline')) {
    Object.defineProperty(dbg, 'pipeline', {
      get() {
        cblcarsLog.warn('[DebugInterface] ⚠️ window.cblcars.debug.msd.pipeline is deprecated. Use window.cblcars.debug.msd.pipelineInstance instead.');
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

  // ✅ PHASE 4: Add deprecation warnings for legacy duplicate methods
  setupDeprecationWarnings(dbg);

 // cblcarsLog.debug('[DebugInterface] Debug interface setup complete');
 // cblcarsLog.debug('[DebugInterface] Available methods:', Object.keys(dbg));

  // Log debug config state (REDUCED)
  if (debugConfig.enabled) {
    cblcarsLog.debug('[DebugInterface] Debug mode enabled');
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
        cblcarsLog.warn('[DebugInterface] ⚠️ routing.stats failed:', e);
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
        cblcarsLog.warn('[DebugInterface] ⚠️ inspectAs failed', e);
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
      cblcarsLog.debug('[DebugInterface] Created dataSourcesDebug as alternative access due to getter conflict');
    }
  }

  // ADDED: Legacy compatibility layer for any remaining entity access patterns
  // This provides entity-like access through DataSourceManager
  dbg.entities = {
    list: () => {
      cblcarsLog.warn('[DebugInterface] ⚠️ entities.list() is deprecated. Use window.__msdDebug.dataSourceManager.listIds() instead.');
      return systemsManager.dataSourceManager?.listIds() || [];
    },
    get: (id) => {
      cblcarsLog.warn('[DebugInterface] ⚠️ entities.get() is deprecated. Use window.__msdDebug.dataSourceManager.getEntity() instead.');
      return systemsManager.dataSourceManager?.getEntity(id) || null;
    },
    stats: () => {
      cblcarsLog.warn('[DebugInterface] ⚠️ entities.stats() is deprecated. Use window.__msdDebug.dataSources.stats() instead.');
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
            cblcarsLog.debug('[DebugInterface] Force re-render after enable:', feature);
            pipelineInstance.reRender();
          }
        } catch (error) {
          cblcarsLog.warn('[DebugInterface] ⚠️ Failed to trigger re-render:', error);
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
            cblcarsLog.debug('[DebugInterface] Force re-render after disable:', feature);
            pipelineInstance.reRender();
          }
        } catch (error) {
          cblcarsLog.warn('[DebugInterface] Failed to trigger re-render:', error);
        }
      }, 10);
    },

    // Manual debug render test
    testRender: () => {
      cblcarsLog.debug('[DebugInterface] Testing debug render directly...');
      try {
        const debugState = debugManager.getSnapshot();
        cblcarsLog.debug('[DebugInterface] Current state:', debugState);

        // Get pipeline instance to access the shadowRoot context
        const pipelineInstance = window.__msdDebug?.pipelineInstance;
        if (!pipelineInstance) {
          cblcarsLog.warn('[DebugInterface] No pipeline instance available');
          return;
        }

        // Try to get the shadowRoot from the systems manager
        const systemsManager = pipelineInstance.systemsManager;
        if (!systemsManager) {
          cblcarsLog.warn('[DebugInterface] No systems manager available');
          return;
        }

        // Use the renderer's mount element (shadowRoot)
        const mountEl = systemsManager.renderer?.mountEl;
        if (!mountEl) {
          cblcarsLog.warn('[DebugInterface] No mount element found in renderer');
          return;
        }

        cblcarsLog.debug('[DebugInterface] Found mount element:', mountEl.constructor.name);

        // Get resolved model for proper context
        const resolvedModel = pipelineInstance.getResolvedModel();
        if (!resolvedModel) {
          cblcarsLog.warn('[DebugInterface] No resolved model available');
          return;
        }

        cblcarsLog.debug('[DebugInterface] Calling renderDebugAndControls with shadowRoot context');
        systemsManager.renderDebugAndControls(resolvedModel, mountEl);

      } catch (error) {
        cblcarsLog.error('[DebugInterface] testRender failed:', error);
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
          cblcarsLog.debug('[DebugInterface] Debug overlays refreshed');
        }
      } catch (error) {
        cblcarsLog.warn('[DebugInterface] Failed to trigger pipeline re-render:', error);
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
          cblcarsLog.warn('[DebugInterface] No pipeline instance available');
          return null;
        }

        const model = pipelineInstance.getResolvedModel?.();
        if (!model) {
          cblcarsLog.warn('[DebugInterface] No resolved model available');
          return null;
        }

        const overlay = model.overlays.find(o => o.id === overlayId);
        if (!overlay) {
          cblcarsLog.warn(`[DebugInterface] Overlay "${overlayId}" not found`);
          return null;
        }

        // Get the debug renderer from systems manager
        const debugRenderer = systemsManager.debugRenderer;
        if (!debugRenderer) {
          cblcarsLog.warn('[DebugInterface] Debug renderer not available');
          return null;
        }

        const position = overlay.position;
        if (!position || !Array.isArray(position)) {
          cblcarsLog.warn(`[DebugInterface] Invalid position for overlay "${overlayId}"`);
          return null;
        }

        const [x, y] = position;
        const dimensions = debugRenderer._getOverlayDimensions(overlay, x, y);

        cblcarsLog.debug(`[DebugInterface] Bounding box test for "${overlayId}":`, {
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
          cblcarsLog.warn('[DebugInterface] No pipeline instance available');
          return null;
        }

        const model = pipelineInstance.getResolvedModel?.();
        if (!model) {
          cblcarsLog.warn('[DebugInterface] No resolved model available');
          return null;
        }

        const overlay = model.overlays.find(o => o.id === overlayId);
        if (!overlay || overlay.type !== 'text') {
          cblcarsLog.warn(`[DebugInterface] Text overlay "${overlayId}" not found`);
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
        }

        console.table(results.methods);
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

  dbg.renderAdvanced = (options) => {
    try {
      cblcarsLog.debug('[DebugInterface] renderAdvanced called - using AdvancedRenderer');
      const model = modelBuilder.getResolvedModel();
      if (model) {
        return systemsManager.renderer.render(model);
      }
      cblcarsLog.warn('[DebugInterface] renderAdvanced: No resolved model available');
      return { svgMarkup: '' };
    } catch (error) {
      cblcarsLog.error('[DebugInterface] renderAdvanced failed:', error);
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
          cblcarsLog.debug('[DebugInterface] HUD auto-shown based on config');
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
    cblcarsLog.info(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                          MSD Debug Interface Help                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Debug Features:                                                              ║
║   __msdDebug.debug.enable('anchors')       - Show anchor point markers       ║
║   __msdDebug.debug.enable('bounding_boxes') - Show overlay bounding boxes    ║
║   __msdDebug.debug.enable('routing')       - Show routing path visualization ║
║   __msdDebug.debug.enable('performance')   - Show performance metrics        ║
║   __msdDebug.debug.enable('all')           - Enable all features             ║
║                                                                              ║
║   __msdDebug.debug.disable('feature')      - Disable specific feature        ║
║   __msdDebug.debug.status()                - Show current debug state        ║
║   __msdDebug.debug.setScale(1.5)           - Set debug element scale         ║
║   __msdDebug.debug.refresh()               - Force re-render debug overlays  ║
║                                                                              ║
║ Quick Access:                                                                ║
║   __msdDebug.debug.anchors.toggle()        - Toggle anchor markers           ║
║   __msdDebug.debug.bounding.toggle()       - Toggle bounding boxes           ║
║   __msdDebug.debug.bounding.test('id')     - Test bounding box accuracy      ║
║   __msdDebug.debug.bounding.compare('id')  - Compare measurement methods     ║
║   __msdDebug.debug.routing.toggle()        - Toggle routing guides           ║
║   __msdDebug.debug.performance.toggle()    - Toggle performance overlay      ║
║                                                                              ║
║ Provenance:                                                                  ║
║   __msdDebug.getStyleResolutions('id')     - Style resolution details        ║
║   __msdDebug.findOverlaysByToken('token')  - Find overlays using token       ║
║   __msdDebug.getGlobalStyleSummary()       - Global style statistics         ║
║                                                                              ║
║ Chart Validation:                                                            ║
║   __msdDebug.charts.validate('id')         - Validate specific chart         ║
║   __msdDebug.charts.validateAll()          - Validate all charts             ║
║   __msdDebug.charts.getFormatSpec('type')  - Get chart data format req       ║
║   __msdDebug.charts.listTypes()            - List supported chart types      ║
║   __msdDebug.charts.checkCompatibility('id') - Check data source compat      ║
║                                                                              ║
║ Data & Entities:                                                             ║
║   __msdDebug.dataSources.stats()           - Data source statistics          ║
║   __msdDebug.dataSources.list()            - List all data sources           ║
║   __msdDebug.dataSources.get('name')       - Get specific data source        ║
║                                                                              ║
║ Routing:                                                                     ║
║   __msdDebug.routing.inspect('overlay_id') - Inspect routing path            ║
║   __msdDebug.routing.stats()               - Routing system statistics       ║
║   __msdDebug.routing.invalidate()          - Clear routing cache             ║
║                                                                              ║
║ Performance:                                                                 ║
║   __msdDebug.getPerf()                     - Get performance metrics         ║
║   __msdDebug.perf()                        - Alternative performance data    ║
║                                                                              ║
║ Performance (Phase 5.3):                                                     ║
║   __msdDebug.getPerformanceSummary()       - Complete performance summary    ║
║   __msdDebug.getSlowestOverlays(5)         - Get slowest overlays            ║
║   __msdDebug.getRendererPerformance()      - Performance by overlay type     ║
║   __msdDebug.getOverlayPerformance('id')   - Performance for specific overlay║
║   __msdDebug.getPerformanceWarnings()      - Check for slow overlays         ║
║   __msdDebug.getRenderTimeline()           - Stage-by-stage timing           ║
║   __msdDebug.compareRendererPerformance()  - Compare renderer efficiency     ║
║                                                                              ║                                                                              ║
║ Other Tools:                                                                 ║
║   __msdDebug.hud.toggle()                  - Toggle HUD overlay              ║
║   __msdDebug.rules.trace()                 - Show rules engine trace         ║
║   __msdDebug.validation.issues()           - Show configuration issues       ║
║   __msdDebug.usage()                       - Show simplified usage examples  ║
║                                                                              ║
║ Pipeline:                                                                    ║
║   __msdDebug.pipelineInstance              - Direct pipeline access          ║
╚══════════════════════════════════════════════════════════════════════════════╝
    `);
  };

  // ADD: Simplified usage examples
  dbg.usage = function() {
    cblcarsLog.info(`
🔧 Quick MSD Debug Commands:

Enable debug features:
  __msdDebug.debug.enable('anchors')      # Show anchor points
  __msdDebug.debug.enable('bounding_boxes') # Show overlay bounds
  __msdDebug.debug.enable('all')          # Enable everything

Check status:
  __msdDebug.debug.status()               # Current debug state
  __msdDebug.dataSources.stats()          # Data source info
  __msdDebug.getPerf()                    # Performance metrics

Style Resolution (NEW):
  __msdDebug.getStyleResolutions('id')    # See how styles were resolved
  __msdDebug.findOverlaysByToken('token') # Find token usage
  __msdDebug.getGlobalStyleSummary()      # Global style stats

Quick toggles:
  __msdDebug.debug.anchors.toggle()       # Toggle anchors
  __msdDebug.debug.bounding.toggle()      # Toggle bounding boxes
  __msdDebug.debug.bounding.test('id')    # Test bounding accuracy
  __msdDebug.debug.routing.toggle()       # Toggle routing guides

Performance Analysis:
  __msdDebug.getPerformanceSummary()      # Complete render performance
  __msdDebug.getSlowestOverlays(5)        # Find bottlenecks
  __msdDebug.getPerformanceWarnings()     # Check for slow overlays
  __msdDebug.getRenderTimeline()          # Stage-by-stage breakdown

  Chart Validation:
  __msdDebug.charts.validate('temp_chart')  # Validate specific chart
  __msdDebug.charts.validateAll()           # Validate all charts
  __msdDebug.charts.listTypes()             # List supported types

For full help: __msdDebug.help()
    `);
  };

  // Log debug config state (REDUCED)
  if (debugConfig.enabled) {
    cblcarsLog.debug('[DebugInterface] Debug mode enabled');
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


  // ✅ NEW: Phase 5.3 - Enhanced Performance Analysis Commands

  /**
   * Get comprehensive performance summary from last render
   * @returns {Object} Performance summary with stage breakdowns
   */
  dbg.getPerformanceSummary = function() {
    const pipelineInstance = window.__msdDebug?.pipelineInstance;
    if (!pipelineInstance) {
      console.warn('[MSD Debug] No pipeline instance available');
      return null;
    }

    // Get performance from AdvancedRenderer provenance
    const config = pipelineInstance.config;
    const advancedRendererProvenance = config?.__provenance?.advanced_renderer;

    if (!advancedRendererProvenance?.performance) {
      console.warn('[MSD Debug] No performance data available - ensure overlays have been rendered');
      return null;
    }

    const perf = advancedRendererProvenance.performance;

    console.log('⚡ Performance Summary:');
    console.log('═══════════════════════════════════');
    console.log(`Total Render Time: ${perf.total_render_time_ms.toFixed(2)}ms`);
    console.log(`Overlays Rendered: ${perf.overlay_count}`);
    console.log(`Average per Overlay: ${perf.average_per_overlay_ms.toFixed(2)}ms`);
    console.log('');
    console.log('📊 Stage Breakdown:');
    console.log(`  Preparation: ${perf.stages.preparation_ms.toFixed(2)}ms`);
    console.log(`  Overlay Rendering: ${perf.stages.overlay_rendering_ms.toFixed(2)}ms`);
    console.log(`  DOM Injection: ${perf.stages.dom_injection_ms.toFixed(2)}ms`);
    console.log(`  Action Attachment: ${perf.stages.action_attachment_ms.toFixed(2)}ms`);
    console.log('');
    console.log('🐌 Slowest Overlays:');
    console.table(perf.slowest_overlays);

    return perf;
  };

  /**
   * Get slowest overlays from last render
   * @param {number} count - Number of slowest overlays to return (default: 5)
   * @returns {Array} Array of slowest overlay performance data
   */
  dbg.getSlowestOverlays = function(count = 5) {
    const pipelineInstance = window.__msdDebug?.pipelineInstance;
    if (!pipelineInstance) {
      console.warn('[MSD Debug] No pipeline instance available');
      return null;
    }

    const renderer = pipelineInstance.systemsManager?.renderer;
    if (!renderer || typeof renderer.getSlowestOverlays !== 'function') {
      console.warn('[MSD Debug] Renderer not available or does not support performance tracking');
      return null;
    }

    const slowest = renderer.getSlowestOverlays(count);

    console.log(`🐌 ${count} Slowest Overlays:`);
    console.log('═══════════════════════════════════');
    slowest.forEach((overlay, index) => {
      console.log(`${index + 1}. ${overlay.overlay_id} (${overlay.type}): ${overlay.duration_ms.toFixed(2)}ms (${overlay.percentage_of_total}%)`);
    });

    return slowest;
  };

  /**
   * Get performance breakdown by overlay type
   * @returns {Object} Performance data grouped by type
   */
  dbg.getRendererPerformance = function() {
    const pipelineInstance = window.__msdDebug?.pipelineInstance;
    if (!pipelineInstance) {
      console.warn('[MSD Debug] No pipeline instance available');
      return null;
    }

    const renderer = pipelineInstance.systemsManager?.renderer;
    if (!renderer || typeof renderer.getPerformanceByType !== 'function') {
      console.warn('[MSD Debug] Renderer not available or does not support performance tracking');
      return null;
    }

    const byType = renderer.getPerformanceByType();

    console.log('📊 Performance by Overlay Type:');
    console.log('═══════════════════════════════════');

    // Sort by total time
    const sortedTypes = Object.entries(byType)
      .sort((a, b) => b[1].total_ms - a[1].total_ms);

    sortedTypes.forEach(([type, data]) => {
      console.log(`\n${type.toUpperCase()}:`);
      console.log(`  Count: ${data.count}`);
      console.log(`  Total: ${data.total_ms.toFixed(2)}ms`);
      console.log(`  Average: ${data.average_ms.toFixed(2)}ms`);
      console.log(`  Slowest: ${Math.max(...data.overlays.map(o => o.duration_ms)).toFixed(2)}ms`);
    });

    console.log('\n📋 Detailed Breakdown:');
    console.table(
      Object.entries(byType).map(([type, data]) => ({
        Type: type,
        Count: data.count,
        'Total (ms)': data.total_ms.toFixed(2),
        'Average (ms)': data.average_ms.toFixed(2),
        'Slowest (ms)': Math.max(...data.overlays.map(o => o.duration_ms)).toFixed(2)
      }))
    );

    return byType;
  };

  /**
   * Get performance data for a specific overlay
   * @param {string} overlayId - Overlay ID to get performance for
   * @returns {Object|null} Performance data for the overlay
   */
  dbg.getOverlayPerformance = function(overlayId) {
    const pipelineInstance = window.__msdDebug?.pipelineInstance;
    if (!pipelineInstance) {
      console.warn('[MSD Debug] No pipeline instance available');
      return null;
    }

    const renderer = pipelineInstance.systemsManager?.renderer;
    if (!renderer || typeof renderer.getOverlayPerformance !== 'function') {
      console.warn('[MSD Debug] Renderer not available or does not support performance tracking');
      return null;
    }

    const performance = renderer.getOverlayPerformance(overlayId);

    if (!performance) {
      console.warn(`[MSD Debug] No performance data found for overlay: ${overlayId}`);
      return null;
    }

    console.log(`⚡ Performance for Overlay: ${overlayId}`);
    console.log('═══════════════════════════════════');
    console.log(`Type: ${performance.type}`);
    console.log(`Duration: ${performance.duration_ms.toFixed(2)}ms`);
    console.log(`Percentage of Total: ${performance.percentage_of_total}%`);

    return performance;
  };

  /**
   * Get performance warnings for slow overlays
   * @returns {Object} Performance warnings with details
   */
  dbg.getPerformanceWarnings = function() {
    const pipelineInstance = window.__msdDebug?.pipelineInstance;
    if (!pipelineInstance) {
      console.warn('[MSD Debug] No pipeline instance available');
      return null;
    }

    const renderer = pipelineInstance.systemsManager?.renderer;
    if (!renderer || typeof renderer.getPerformanceWarnings !== 'function') {
      console.warn('[MSD Debug] Renderer not available or does not support performance tracking');
      return null;
    }

    const warnings = renderer.getPerformanceWarnings();

    if (!warnings.has_warnings) {
      console.log('✅ No performance warnings - all overlays rendering efficiently!');
      return warnings;
    }

    console.log(`⚠️ Performance Warnings (${warnings.count}):`);
    console.log('═══════════════════════════════════');

    warnings.warnings.forEach((warning, index) => {
      console.log(`\n${index + 1}. ${warning.type.toUpperCase()}`);
      console.log(`   ${warning.message}`);
      if (warning.overlay_id) {
        console.log(`   Overlay: ${warning.overlay_id}`);
      }
      console.log(`   Value: ${warning.value.toFixed(2)}ms`);
      console.log(`   Threshold: ${warning.threshold}ms`);
    });

    console.log('\n📋 Warning Summary:');
    console.table(warnings.warnings);

    return warnings;
  };

  /**
   * Get render timeline (stage-by-stage breakdown)
   * @returns {Object} Timeline of render stages
   */
  dbg.getRenderTimeline = function() {
    const pipelineInstance = window.__msdDebug?.pipelineInstance;
    if (!pipelineInstance) {
      console.warn('[MSD Debug] No pipeline instance available');
      return null;
    }

    const config = pipelineInstance.config;
    const advancedRendererProvenance = config?.__provenance?.advanced_renderer;

    if (!advancedRendererProvenance?.performance) {
      console.warn('[MSD Debug] No performance data available');
      return null;
    }

    const perf = advancedRendererProvenance.performance;
    const stages = perf.stages;
    const total = perf.total_render_time_ms;

    const timeline = [
      {
        stage: 'Preparation',
        duration_ms: stages.preparation_ms.toFixed(2),
        percentage: ((stages.preparation_ms / total) * 100).toFixed(1) + '%',
        description: 'Initialize structures, compute attachment points'
      },
      {
        stage: 'Overlay Rendering',
        duration_ms: stages.overlay_rendering_ms.toFixed(2),
        percentage: ((stages.overlay_rendering_ms / total) * 100).toFixed(1) + '%',
        description: 'Generate SVG markup for all overlays'
      },
      {
        stage: 'DOM Injection',
        duration_ms: stages.dom_injection_ms.toFixed(2),
        percentage: ((stages.dom_injection_ms / total) * 100).toFixed(1) + '%',
        description: 'Inject markup into DOM, attach actions'
      },
      {
        stage: 'Action Attachment',
        duration_ms: stages.action_attachment_ms.toFixed(2),
        percentage: ((stages.action_attachment_ms / total) * 100).toFixed(1) + '%',
        description: 'Attach event handlers to interactive elements'
      }
    ];

    console.log('⏱️ Render Timeline:');
    console.log('═══════════════════════════════════');
    console.log(`Total: ${total.toFixed(2)}ms\n`);

    timeline.forEach((stage, index) => {
      const bar = '█'.repeat(Math.round(parseFloat(stage.percentage) / 2));
      console.log(`${index + 1}. ${stage.stage}`);
      console.log(`   ${stage.duration_ms}ms (${stage.percentage}) ${bar}`);
      console.log(`   ${stage.description}`);
      console.log('');
    });

    console.table(timeline);

    return {
      total_ms: total,
      stages: timeline
    };
  };

  /**
   * Compare renderer performance across overlay types
   * @returns {Object} Comparison of renderer performance
   */
  dbg.compareRendererPerformance = function() {
    const pipelineInstance = window.__msdDebug?.pipelineInstance;
    if (!pipelineInstance) {
      console.warn('[MSD Debug] No pipeline instance available');
      return null;
    }

    const config = pipelineInstance.config;
    const advancedRendererProvenance = config?.__provenance?.advanced_renderer;

    if (!advancedRendererProvenance?.render_summary) {
      console.warn('[MSD Debug] No renderer summary available');
      return null;
    }

    const summary = advancedRendererProvenance.render_summary;
    const byRenderer = summary.by_renderer;

    console.log('🔧 Renderer Performance Comparison:');
    console.log('═══════════════════════════════════');

    const rendererData = Object.entries(byRenderer)
      .map(([renderer, data]) => ({
        Renderer: renderer,
        Count: data.count,
        'Total Time (ms)': data.total_time_ms.toFixed(2),
        'Average (ms)': (data.total_time_ms / data.count).toFixed(2)
      }))
      .sort((a, b) => parseFloat(b['Total Time (ms)']) - parseFloat(a['Total Time (ms)']));

    console.table(rendererData);

    return byRenderer;
  };




  // Validation
  dbg.validation = {
    issues: () => {
      try {
        return mergedConfig.__issues || { errors: [], warnings: [] };
      } catch (e) {
        cblcarsLog.warn('[DebugInterface] validation.issues failed:', e);
        return { errors: [], warnings: [] };
      }
    }
  };

  // ✅ NEW: Chart Data Validation Commands
  dbg.charts = {
    /**
     * Validate a specific chart overlay
     * @param {string} overlayId - Chart overlay ID
     * @returns {Object} Validation result
     */
    validate: (overlayId) => {
      const pipelineInstance = window.__msdDebug?.pipelineInstance;
      if (!pipelineInstance) {
        console.error('[Charts] ❌ No pipeline instance available');
        return null;
      }

      const model = pipelineInstance.getResolvedModel?.();
      if (!model) {
        console.error('[Charts] ❌ No resolved model available');
        return null;
      }

      const overlay = model.overlays.find(o => o.id === overlayId);
      if (!overlay) {
        console.error(`[Charts] ❌ Overlay "${overlayId}" not found`);
        return null;
      }

      if (overlay.type !== 'apexchart') {
        console.error(`[Charts] ❌ Overlay "${overlayId}" is not an ApexChart (type: ${overlay.type})`);
        return null;
      }

      const context = {
        dataSourceManager: systemsManager.dataSourceManager
      };

      const result = ChartDataValidator.validate(overlay, context);

      console.log(`\n📊 Chart Validation: ${overlayId}`);
      console.log('═══════════════════════════════════');

      if (result.valid) {
        console.log('✅ Chart data format is VALID');
      } else {
        console.log('❌ Chart validation FAILED');
        console.log('\n🔴 Errors:');
        result.errors.forEach((error, index) => {
          console.log(`\n${index + 1}. ${error.message}`);
          if (error.requiredFormat) {
            console.log(`   Required: ${error.requiredFormat}`);
          }
          if (error.suggestion) {
            console.log(`   💡 Fix: ${error.suggestion}`);
          }
          if (error.example) {
            console.log(`   📝 Example: ${error.example}`);
          }
        });
      }

      if (result.warnings.length > 0) {
        console.log('\n⚠️ Warnings:');
        result.warnings.forEach((warning, index) => {
          console.log(`${index + 1}. ${warning.message}`);
          if (warning.suggestion) {
            console.log(`   💡 ${warning.suggestion}`);
          }
        });
      }

      return result;
    },

    /**
     * Validate all chart overlays
     * @returns {Object} Summary of validation results
     */
    validateAll: () => {
      const pipelineInstance = window.__msdDebug?.pipelineInstance;
      if (!pipelineInstance) {
        console.error('[Charts] ❌ No pipeline instance available');
        return null;
      }

      const model = pipelineInstance.getResolvedModel?.();
      if (!model) {
        console.error('[Charts] ❌ No resolved model available');
        return null;
      }

      const charts = model.overlays.filter(o => o.type === 'apexchart');

      if (charts.length === 0) {
        console.log('[Charts] ℹ️ No ApexChart overlays found');
        return { total: 0, valid: 0, invalid: 0, results: [] };
      }

      const context = {
        dataSourceManager: systemsManager.dataSourceManager
      };

      const results = charts.map(overlay => {
        const result = ChartDataValidator.validate(overlay, context);
        return {
          overlayId: overlay.id,
          chartType: overlay.style?.chart_type || overlay.finalStyle?.chart_type || 'line',
          valid: result.valid,
          errors: result.errors.length,
          warnings: result.warnings.length,
          result: result
        };
      });

      const summary = {
        total: results.length,
        valid: results.filter(r => r.valid).length,
        invalid: results.filter(r => !r.valid).length,
        results: results
      };

      console.log('\n📊 Chart Validation Summary');
      console.log('═══════════════════════════════════');
      console.log(`Total Charts: ${summary.total}`);
      console.log(`✅ Valid: ${summary.valid}`);
      console.log(`❌ Invalid: ${summary.invalid}`);

      if (summary.invalid > 0) {
        console.log('\n🔴 Invalid Charts:');
        results.filter(r => !r.valid).forEach((result, index) => {
          console.log(`\n${index + 1}. ${result.overlayId} (${result.chartType})`);
          console.log(`   Errors: ${result.errors}, Warnings: ${result.warnings}`);
          result.result.errors.forEach(error => {
            console.log(`   - ${error.message}`);
          });
        });
      }

      console.log('\n📋 Detailed Results:');
      console.table(results.map(r => ({
        'Overlay ID': r.overlayId,
        'Chart Type': r.chartType,
        'Valid': r.valid ? '✅' : '❌',
        'Errors': r.errors,
        'Warnings': r.warnings
      })));

      return summary;
    },

    /**
     * Get data format specification for a chart type
     * @param {string} chartType - Chart type (e.g., 'line', 'rangeArea')
     * @returns {Object|null} Format specification
     */
    getFormatSpec: (chartType) => {
      const spec = ChartDataValidator.getFormatSpec(chartType);

      if (!spec) {
        console.error(`[Charts] ❌ Unknown chart type: ${chartType}`);
        console.log(`\nSupported types: ${ChartDataValidator.getSupportedChartTypes().join(', ')}`);
        return null;
      }

      console.log(`\n📊 Chart Type: ${chartType}`);
      console.log('═══════════════════════════════════');
      console.log(`Data Format: ${spec.dataFormat}`);
      console.log(`Value Type: ${spec.valueType}`);
      console.log(`Series Structure: ${spec.seriesStructure}`);
      console.log(`\nDescription: ${spec.description}`);
      console.log(`\n📝 Example:\n${spec.example}`);

      if (spec.requiredFields) {
        console.log(`\n✅ Required Fields: ${spec.requiredFields.join(', ')}`);
      }

      if (spec.transformationHint) {
        console.log(`\n💡 Transformation Hint:\n${spec.transformationHint}`);
      }

      return spec;
    },

    /**
     * List all supported chart types
     * @returns {Array<string>} Array of supported chart types
     */
    listTypes: () => {
      const types = ChartDataValidator.getSupportedChartTypes();

      console.log('\n📊 Supported ApexCharts Types');
      console.log('═══════════════════════════════════');

      // Group by data format
      const byFormat = {
        'Single Value (Timeseries)': ['line', 'area', 'bar', 'column', 'scatter'],
        'Range Data': ['rangeArea', 'rangeBar'],
        'OHLC/Distribution': ['candlestick', 'boxPlot'],
        'Simple Numeric': ['pie', 'donut', 'radialBar'],
        'Special': ['radar', 'polarArea', 'heatmap', 'treemap']
      };

      Object.entries(byFormat).forEach(([category, chartTypes]) => {
        console.log(`\n${category}:`);
        chartTypes.forEach(type => {
          const spec = ChartDataValidator.getFormatSpec(type);
          console.log(`  - ${type}: ${spec?.description || 'No description'}`);
        });
      });

      return types;
    },

    /**
     * Check data source compatibility for a chart
     * @param {string} overlayId - Chart overlay ID
     * @returns {Object|null} Compatibility analysis
     */
    checkCompatibility: (overlayId) => {
      const pipelineInstance = window.__msdDebug?.pipelineInstance;
      if (!pipelineInstance) {
        console.error('[Charts] ❌ No pipeline instance available');
        return null;
      }

      const model = pipelineInstance.getResolvedModel?.();
      if (!model) {
        console.error('[Charts] ❌ No resolved model available');
        return null;
      }

      const overlay = model.overlays.find(o => o.id === overlayId);
      if (!overlay || overlay.type !== 'apexchart') {
        console.error(`[Charts] ❌ ApexChart overlay "${overlayId}" not found`);
        return null;
      }

      const style = overlay.finalStyle || overlay.style || {};
      const chartType = style.chart_type || style.type || 'line';
      const sourceRef = overlay.source || overlay.data_source || overlay.sources;

      const spec = ChartDataValidator.getFormatSpec(chartType);
      if (!spec) {
        console.error(`[Charts] ❌ Unknown chart type: ${chartType}`);
        return null;
      }

      console.log(`\n🔍 Compatibility Check: ${overlayId}`);
      console.log('═══════════════════════════════════');
      console.log(`Chart Type: ${chartType}`);
      console.log(`Required Format: ${spec.valueType}`);
      console.log(`Data Source: ${Array.isArray(sourceRef) ? sourceRef.join(', ') : sourceRef}`);

      const context = {
        dataSourceManager: systemsManager.dataSourceManager
      };

      const result = ChartDataValidator.validate(overlay, context);

      if (result.valid) {
        console.log('\n✅ Data source is COMPATIBLE');
      } else {
        console.log('\n❌ Data source is INCOMPATIBLE');
        console.log('\n🔴 Issues:');
        result.errors.forEach((error, index) => {
          console.log(`\n${index + 1}. ${error.message}`);
          if (error.suggestion) {
            console.log(`   💡 Fix: ${error.suggestion}`);
          }
        });
      }

      return {
        overlayId,
        chartType,
        sourceRef,
        requiredFormat: spec.valueType,
        compatible: result.valid,
        issues: result.errors,
        warnings: result.warnings
      };
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
      cblcarsLog.info('[DebugInterface] line endpoint markers', this.markersEnabled?'ENABLED':'DISABLED');
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

  // ✅ NEW: Phase 5.2B - Style Resolution Debug Methods
  // These use the provenance data collected by renderers via index.js

  /**
   * Get style resolution details for an overlay
   *
   * ✅ NEW: Phase 5.2B - Style resolution inspection
   *
   * @param {string} overlayId - Overlay ID
   * @returns {Object|null} Style resolution details
   */
  dbg.getStyleResolutions = function(overlayId) {
    // Access provenance from index.js methods
    const provenance = dbg.getRendererInfo ? dbg.getRendererInfo(overlayId) : null;

    if (!provenance || !provenance.style_resolution) {
      console.warn(`No style resolution data for overlay: ${overlayId}`);
      console.log('Try using: __msdDebug.getRendererInfo("${overlayId}") for full provenance');
      return null;
    }

    const summary = provenance.style_resolution;

    console.log(`📊 Style Resolutions for ${overlayId}:`);
    console.log(`Total properties resolved: ${summary.total}`);
    console.log(`\n📈 By Source:`);
    Object.entries(summary.by_source).forEach(([source, count]) => {
      const percentage = ((count / summary.total) * 100).toFixed(1);
      console.log(`  ${source}: ${count} (${percentage}%)`);
    });

    console.log(`\n📋 Property Details:`);
    console.table(summary.properties);

    return summary;
  };

  /**
   * Find all overlays that used a specific token
   *
   * ✅ NEW: Phase 5.2B - Token usage tracking
   *
   * @param {string} tokenPath - Token path (e.g., 'colors.primary')
   * @returns {Array} List of overlay IDs using this token
   */
  dbg.findOverlaysByToken = function(tokenPath) {
    const results = [];

    const overlayIds = dbg.listTrackedOverlays ? dbg.listTrackedOverlays() : [];

    overlayIds.forEach(overlayId => {
      const provenance = dbg.getRendererInfo ? dbg.getRendererInfo(overlayId) : null;
      if (!provenance?.style_resolution) return;

      const usesToken = provenance.style_resolution.properties.some(
        prop => prop.token === tokenPath
      );

      if (usesToken) {
        const properties = provenance.style_resolution.properties
          .filter(prop => prop.token === tokenPath)
          .map(prop => prop.property);

        results.push({
          overlayId,
          renderer: provenance.renderer,
          overlay_type: provenance.overlay_type,
          properties
        });
      }
    });

    console.log(`🔍 Overlays using token '${tokenPath}':`);
    if (results.length === 0) {
      console.log('  No overlays found using this token');
    } else {
      results.forEach(result => {
        console.log(`  ${result.overlayId} (${result.overlay_type}):`);
        result.properties.forEach(prop => {
          console.log(`    - ${prop}`);
        });
      });
    }

    return results;
  };

  /**
   * Get summary of all style resolution sources across all overlays
   *
   * ✅ NEW: Phase 5.2B - Global style analysis
   *
   * @returns {Object} Global style resolution summary
   */
  dbg.getGlobalStyleSummary = function() {
    const global = {
      total_overlays: 0,
      total_resolutions: 0,
      by_source: {},
      by_renderer: {},
      by_overlay_type: {}
    };

    const overlayIds = dbg.listTrackedOverlays ? dbg.listTrackedOverlays() : [];

    overlayIds.forEach(overlayId => {
      const provenance = dbg.getRendererInfo ? dbg.getRendererInfo(overlayId) : null;
      if (!provenance?.style_resolution) return;

      global.total_overlays++;
      global.total_resolutions += provenance.style_resolution.total;

      // Aggregate by source
      Object.entries(provenance.style_resolution.by_source).forEach(([source, count]) => {
        if (!global.by_source[source]) global.by_source[source] = 0;
        global.by_source[source] += count;
      });

      // Aggregate by renderer
      const renderer = provenance.renderer;
      if (!global.by_renderer[renderer]) {
        global.by_renderer[renderer] = { count: 0, resolutions: 0 };
      }
      global.by_renderer[renderer].count++;
      global.by_renderer[renderer].resolutions += provenance.style_resolution.total;

      // Aggregate by overlay type
      const overlayType = provenance.overlay_type || 'unknown';
      if (!global.by_overlay_type[overlayType]) {
        global.by_overlay_type[overlayType] = { count: 0, resolutions: 0 };
      }
      global.by_overlay_type[overlayType].count++;
      global.by_overlay_type[overlayType].resolutions += provenance.style_resolution.total;
    });

    console.log(`🌍 Global Style Resolution Summary:`);
    console.log(`═══════════════════════════════════`);
    console.log(`Total overlays tracked: ${global.total_overlays}`);
    console.log(`Total style resolutions: ${global.total_resolutions}`);
    if (global.total_overlays > 0) {
      console.log(`Average per overlay: ${(global.total_resolutions / global.total_overlays).toFixed(1)}`);
    }

    console.log(`\n📊 By Source:`);
    const totalSourceResolutions = Object.values(global.by_source).reduce((a, b) => a + b, 0);
    if (totalSourceResolutions > 0) {
      Object.entries(global.by_source).forEach(([source, count]) => {
        const percentage = ((count / totalSourceResolutions) * 100).toFixed(1);
        console.log(`  ${source}: ${count} (${percentage}%)`);
      });
    }

    console.log(`\n🔧 By Renderer:`);
    console.table(global.by_renderer);

    console.log(`\n📑 By Overlay Type:`);
    console.table(global.by_overlay_type);

    return global;
  };
}