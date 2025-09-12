import { AdvancedRenderer } from '../renderer/AdvancedRenderer.js';
import { MsdDebugRenderer } from '../debug/MsdDebugRenderer.js';
import { MsdControlsRenderer } from '../controls/MsdControlsRenderer.js';
import { MsdHudManager } from '../hud/MsdHudManager.js';
import { DataSourceManager } from '../data/DataSourceManager.js';
import { RouterCore } from '../routing/RouterCore.js';
import { AnimationRegistry } from '../animation/AnimationRegistry.js';
import { RulesEngine } from '../rules/RulesEngine.js';
import { DebugManager } from '../debug/DebugManager.js';

export class SystemsManager {
  constructor() {
    this.dataSourceManager = null;
    this.renderer = null;
    this.debugRenderer = null;
    this.controlsRenderer = null;
    this.hudManager = null;
    this.router = null;
    this.animRegistry = null;
    this.rulesEngine = null;
    this.debugManager = new DebugManager();
    this._renderTimeout = null;
    this._reRenderCallback = null;
    this.mergedConfig = null; // Store for entity change handler
  }

  async initializeSystems(mergedConfig, cardModel, mountEl, hass) {
    console.log('[MSD v1] Initializing runtime systems');

    // Store config for later use
    this.mergedConfig = mergedConfig;

    // ADDED: Store HASS context immediately
    this._currentHass = hass;

    // ENHANCED: Initialize debug manager early with config and better logging
    const debugConfig = mergedConfig.debug || {};
    console.log('[MSD v1] Raw debug config from mergedConfig:', debugConfig);

    this.debugManager.init(debugConfig);
    console.log('[MSD v1] DebugManager initialized with config:', debugConfig);

    // Initialize rules engine
    this.rulesEngine = new RulesEngine(mergedConfig.rules);
    this.rulesEngine.markAllDirty();
    this._instrumentRulesEngine(mergedConfig);

    // Initialize data source manager FIRST
    await this._initializeDataSources(hass, mergedConfig);

    // Connect data source manager to rules engine
    if (this.dataSourceManager) {
      const entityChangeHandler = this._createEntityChangeHandler();

      // DEBUGGING: Wrap the handler to ensure it's being called
      const debugWrappedHandler = (changedIds) => {
        console.log('[MSD v1] 🔔 Entity change handler CALLED with:', changedIds);

        // CRITICAL: Check if any of the changed IDs are our auto-created control entities
        const controlEntities = this._extractControlEntities(this.mergedConfig);
        const relevantChanges = changedIds.filter(id => controlEntities.includes(id));

        if (relevantChanges.length > 0) {
          console.log('[MSD v1] 🎯 Control entity changes detected:', relevantChanges);
        }

        return entityChangeHandler(changedIds);
      };

      this.dataSourceManager.addEntityChangeListener(debugWrappedHandler);
      console.log('[MSD v1] DataSourceManager connected to rules engine with debug wrapper');

      // DEBUGGING: Let's manually hook into individual data sources that might be getting the events
      setTimeout(() => {
        console.log('[MSD v1] 🔍 Investigating which data source is receiving light.desk events...');

        // Check all data sources and see which ones have light.desk
        const allSources = this.dataSourceManager._sources || {};
        Object.entries(allSources).forEach(([id, source]) => {
          if (source && source.config && source.config.entity === 'light.desk') {
            console.log(`[MSD v1] 🎯 Found data source for light.desk: ${id}`, source);

            // Try to hook into this specific data source's events
            if (typeof source.addEntityChangeListener === 'function') {
              console.log(`[MSD v1] Adding direct listener to data source: ${id}`);
              source.addEntityChangeListener((changedIds) => {
                console.log(`[MSD v1] 🔔 Direct data source ${id} entity change:`, changedIds);
                debugWrappedHandler(changedIds);
              });
            } else if (typeof source.subscribe === 'function') {
              console.log(`[MSD v1] Adding subscriber to data source: ${id}`);
              source.subscribe((data) => {
                console.log(`[MSD v1] 🔔 Direct data source ${id} subscription update:`, data);
                debugWrappedHandler(['light.desk']);
              });
            } else {
              console.log(`[MSD v1] Data source ${id} methods:`, Object.getOwnPropertyNames(source.__proto__));
            }
          }
        });

        // Also try to find what's logging the "[MsdDataSource] 📊 HA event received" message
        console.log('[MSD v1] All data sources:', Object.keys(allSources));
      }, 1000);

      // WORKAROUND: Since auto data sources aren't triggering entity change events properly,
      // let's hook directly into the global HA event system for control entities
      const controlEntities = this._extractControlEntities(this.mergedConfig);
      if (controlEntities.length > 0 && this._currentHass) {
        console.log('[MSD v1] Setting up direct HA event monitoring for control entities:', controlEntities);

        // Subscribe to HA state changes directly
        const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
        const self = this;

        EventTarget.prototype.dispatchEvent = function(event) {
          // DEBUGGING: Log all events for light.desk to see what's actually happening
          if (event.type && (event.type.includes('state') || event.type.includes('change'))) {
            if (event.detail?.entity_id === 'light.desk' ||
                (typeof event.detail === 'string' && event.detail.includes('light.desk')) ||
                (event.target && event.target.toString && event.target.toString().includes('light.desk'))) {
              console.log('[MSD v1] 🔍 HA Event Debug - Event for light.desk:', {
                type: event.type,
                detail: event.detail,
                target: event.target?.tagName || event.target?.constructor?.name,
                event: event
              });
            }
          }

          // Check if this is a HA state change event for our entities
          if (event.type === 'state-changed' && event.detail) {
            const entityId = event.detail.entity_id;
            if (controlEntities.includes(entityId)) {
              console.log('[MSD v1] 🎯 Direct HA state change detected for control entity:', entityId, event.detail.new_state?.state);

              // Trigger our entity change handler directly
              setTimeout(() => {
                debugWrappedHandler([entityId]);
              }, 100);
            }
          }

          return originalDispatchEvent.call(this, event);
        };        console.log('[MSD v1] ✅ Direct HA event monitoring established');

        // AGGRESSIVE WORKAROUND: Hook into console.log to catch the data source events
        const originalConsoleLog = console.log;
        console.log = function(...args) {
          // Check if this is the MsdDataSource event we're looking for
          if (args[0] && typeof args[0] === 'string' &&
              args[0].includes('[MsdDataSource] 📊 HA event received for light.desk')) {

            originalConsoleLog.call(console, '[MSD v1] 🎯 Intercepted MsdDataSource event for light.desk!');

            // The state might be in a separate argument
            originalConsoleLog.call(console, '[MSD v1] 🔍 All console.log args:', args);

            let extractedState = null;

            // Try to extract state from the first argument
            const logMessage = args[0];
            const stateMatch = logMessage.match(/light\.desk: (\w+)/);

            if (stateMatch) {
              extractedState = stateMatch[1];
              originalConsoleLog.call(console, `[MSD v1] ✅ Extracted state from arg 0: ${extractedState}`);
            } else if (args[1] && typeof args[1] === 'string') {
              // State might be in the second argument
              extractedState = args[1].trim();
              originalConsoleLog.call(console, `[MSD v1] ✅ Extracted state from arg 1: ${extractedState}`);
            } else {
              originalConsoleLog.call(console, '[MSD v1] ❌ Could not extract state from any argument');
            }

            if (extractedState) {
              // Trigger our entity change handler
              originalConsoleLog.call(console, '[MSD v1] 🚀 Triggering entity change handler...');
              setTimeout(() => {
                originalConsoleLog.call(console, '[MSD v1] 🚀 setTimeout fired, calling debugWrappedHandler');
                try {
                  debugWrappedHandler(['light.desk']);
                  originalConsoleLog.call(console, '[MSD v1] ✅ debugWrappedHandler completed');
                } catch (e) {
                  originalConsoleLog.call(console, '[MSD v1] ❌ debugWrappedHandler failed:', e);
                }
              }, 50);
            }
          }

          return originalConsoleLog.apply(console, args);
        };        console.log('[MSD v1] ✅ Aggressive console.log monitoring established');
      }

      // ADDED: Ensure DataSourceManager is accessible for debugging
      console.log('[MSD v1] DataSourceManager entity count:', this.dataSourceManager.listIds().length);
    } else {
      console.warn('[MSD v1] DataSourceManager not initialized - no data sources configured or HASS unavailable');
    }

    // Initialize rendering systems
    this.router = new RouterCore(mergedConfig.routing, cardModel.anchors, cardModel.viewBox);
    this.renderer = new AdvancedRenderer(mountEl, this.router);
    this.debugRenderer = new MsdDebugRenderer();
    this.controlsRenderer = new MsdControlsRenderer(this.renderer);

    // ADDED: Set HASS context on controls renderer immediately if available
    if (this._currentHass && this.controlsRenderer) {
      console.log('[MSD v1] Setting initial HASS context on controls renderer');
      this.controlsRenderer.setHass(this._currentHass);
    }

    // REPLACED: Initialize unified HUD manager with document.body mounting
    this.hudManager = new MsdHudManager();
    this.hudManager.init(mountEl); // Pass mount element for pipeline context, but HUD uses document.body

    // ADDED: Integrate HUD into global debug interface immediately
    this._setupGlobalHudInterface();

    // Initialize debug renderer with systems manager reference
    this.debugRenderer.init(this);

    // Mark router as ready for debug system
    this.debugManager.markRouterReady();
    console.log('[MSD v1] RouterCore marked ready for debug system');

    // Initialize animation registry
    this.animRegistry = new AnimationRegistry();

    console.log('[MSD v1] All systems initialized successfully');
    return this;
  }

  setReRenderCallback(callback) {
    this._reRenderCallback = callback;
  }

  _createEntityChangeHandler() {
    return (changedIds) => {
      console.log('[MSD v1] Entity changes detected:', changedIds);

      // Update HASS context with current state (simplified)
      if (this._currentHass) {
        console.log('[MSD v1] Updating HASS context from entity changes');

        // Forward fresh HASS to controls renderer
        if (this.controlsRenderer) {
          console.log('[MSD v1] Forwarding HASS to controls renderer');
          this.controlsRenderer.setHass(this._currentHass);
        }
      }

      // Mark rules dirty and trigger re-render
      this.rulesEngine.markEntitiesDirty(changedIds);

      if (this._renderTimeout) clearTimeout(this._renderTimeout);
      this._renderTimeout = setTimeout(() => {
        if (this._reRenderCallback) {
          this._reRenderCallback();
        }
        this._renderTimeout = null;
      }, 300);
    };
  }  _instrumentRulesEngine(mergedConfig) {
    try {
      const depIndex = new Map();
      (mergedConfig.rules||[]).forEach(r=>{
        const condBlocks = (r.when && (r.when.all || r.when.any)) || [];
        condBlocks.forEach(c=>{
          const ent = c?.entity;
            if (ent) {
              if (!depIndex.has(ent)) depIndex.set(ent, new Set());
              depIndex.get(ent).add(r.id);
            }
        });
      });
      this.rulesEngine.__hudDeps = depIndex;

      const W = typeof window!=='undefined'?window:{};
      W.__msdDebug = W.__msdDebug || {};
      const perfStore = W.__msdDebug.__perfStore = W.__msdDebug.__perfStore || { counters:{}, timings:{} };
      function perfCount(k,inc=1){ perfStore.counters[k]=(perfStore.counters[k]||0)+inc; }

      if (!this.rulesEngine.__perfWrapped && typeof this.rulesEngine.evaluateDirty === 'function'){
        const orig = this.rulesEngine.evaluateDirty;
        this.rulesEngine.evaluateDirty = function(){
          const ruleCount = (mergedConfig.rules||[]).length;
          perfCount('rules.eval.count', ruleCount||0);
          const res = orig.apply(this, arguments);
          try {
            const trace = (this.getTrace && this.getTrace()) || [];
            const matched = Array.isArray(trace) ? trace.filter(t=>t && t.matched).length : 0;
            perfCount('rules.match.count', matched);
          } catch { /* ignore */ }
          return res;
        };
        this.rulesEngine.__perfWrapped = true;
      }
    } catch(e){
      console.warn('[MSD v1][rules instrumentation] failed', e);
    }
  }

  async _initializeDataSources(hass, mergedConfig) {
    this.dataSourceManager = null;

    // ENHANCED: Better logging and error handling
    if (!hass) {
      console.warn('[MSD v1] No HASS provided - DataSourceManager will not be initialized');
      return;
    }

    // ENHANCED: Auto-create data sources for control overlay entities
    const configuredDataSources = mergedConfig.data_sources || {};
    const autoDataSources = this._extractControlEntities(mergedConfig);

    // Merge configured and auto-discovered data sources
    const allDataSources = { ...configuredDataSources };

    // Add auto data sources for control entities (if not already configured)
    autoDataSources.forEach(entity => {
      const dataSourceId = `auto_${entity.replace('.', '_')}`;
      if (!allDataSources[dataSourceId]) {
        allDataSources[dataSourceId] = {
          type: 'entity',
          entity: entity,
          _autoCreated: true
        };
        console.log(`[MSD v1] ✅ Auto-created data source for control entity: ${entity} -> ${dataSourceId}`);
      } else {
        console.log(`[MSD v1] ℹ️ Data source already configured for entity: ${entity}`);
      }
    });

    console.log('[MSD v1] 📊 Data source summary:', {
      configured: Object.keys(configuredDataSources).length,
      autoCreated: autoDataSources.length,
      total: Object.keys(allDataSources).length,
      autoEntities: autoDataSources,
      allDataSourceIds: Object.keys(allDataSources)
    });

    if (Object.keys(allDataSources).length === 0) {
      console.log('[MSD v1] No data sources (configured or auto-discovered) - DataSourceManager will not be initialized');
      return;
    }

    console.log('[MSD v1] Initializing DataSourceManager with', Object.keys(allDataSources).length, 'sources (', Object.keys(configuredDataSources).length, 'configured +', autoDataSources.length, 'auto)');

    try {
      this.dataSourceManager = new DataSourceManager(hass);
      const sourceCount = await this.dataSourceManager.initializeFromConfig(allDataSources);
      console.log('[MSD v1] ✅ DataSourceManager initialized -', sourceCount, 'sources started');

      // ADDED: Verify entities are available
      const entityIds = this.dataSourceManager.listIds();
      console.log('[MSD v1] ✅ DataSourceManager entities available:', entityIds);

      // CRITICAL: Verify auto-created data sources are properly subscribed
      autoDataSources.forEach(entity => {
        const dataSourceId = `auto_${entity.replace('.', '_')}`;
        const dataSource = this.dataSourceManager.getSource(dataSourceId);
        if (dataSource) {
          console.log(`[MSD v1] ✅ Auto data source verified: ${dataSourceId} for entity ${entity}`);
          console.log(`[MSD v1] Data source state:`, {
            id: dataSourceId,
            entity: entity,
            started: dataSource.isStarted?.() || 'unknown',
            hasSubscription: !!dataSource._hassSubscription,
            config: dataSource.config
          });

          // ADDED: Ensure auto data sources have entity change subscriptions
          if (typeof dataSource.addEntityChangeListener === 'function') {
            const controlEntityHandler = (changedIds) => {
              console.log(`[MSD v1] 🎯 Control entity change detected by ${dataSourceId}:`, changedIds);
              // This will trigger the main entity change handler
              const mainHandler = this._createEntityChangeHandler();
              mainHandler(changedIds);
            };

            try {
              dataSource.addEntityChangeListener(controlEntityHandler);
              console.log(`[MSD v1] ✅ Entity change listener added to auto data source: ${dataSourceId}`);
            } catch (e) {
              console.warn(`[MSD v1] Failed to add entity change listener to ${dataSourceId}:`, e);
            }
          }
        } else {
          console.error(`[MSD v1] ❌ Auto data source missing: ${dataSourceId} for entity ${entity}`);
        }
      });

    } catch (error) {
      console.error('[MSD v1] ❌ DataSourceManager initialization failed:', error);
      console.error('[MSD v1] Error details:', error.stack);
      this.dataSourceManager = null;
    }
  }

  /**
   * Extract entity IDs from control overlays for auto data source creation
   */
  _extractControlEntities(mergedConfig) {
    const entities = new Set();

    // Extract from overlays
    const overlays = mergedConfig.overlays || [];
    overlays.forEach(overlay => {
      if (overlay.type === 'control' && overlay.card) {
        // Check multiple possible entity locations
        const entity = overlay.card.config?.entity ||
                      overlay.card.config?.variables?.entity ||
                      overlay.card.entity;

        if (entity) {
          entities.add(entity);
        }
      }
    });

    // Extract from any other control configurations
    // (Add more extraction logic here as needed)

    return Array.from(entities);
  }

  /**
   * Essential cleanup method
   */
  destroy() {
    if (this.debugRenderer) {
      this.debugRenderer.destroy();
    }

    // Clear render timeout
    if (this._renderTimeout) {
      clearTimeout(this._renderTimeout);
      this._renderTimeout = null;
    }

    // Clear re-render callback
    this._reRenderCallback = null;
  }

  /**
   * Render debug overlays and controls using DebugManager with basic performance tracking
   * @param {Object} resolvedModel - The resolved model
   * @param {Element} mountEl - The shadowRoot/mount element
   */
  async renderDebugAndControls(resolvedModel, mountEl = null) {
    const debugState = this.debugManager.getSnapshot();

    console.log('[SystemsManager] renderDebugAndControls called:', {
      anyEnabled: this.debugManager.isAnyEnabled(),
      controlOverlays: resolvedModel.overlays.filter(o => o.type === 'control').length,
      hasHass: !!this._currentHass
    });

    // Render debug visualizations
    if (this.debugManager.isAnyEnabled()) {
      try {
        const debugOptions = {
          anchors: resolvedModel.anchors,
          overlays: resolvedModel.overlays,
          showAnchors: debugState.anchors,
          showBoundingBoxes: debugState.bounding_boxes,
          showRouting: this.debugManager.canRenderRouting(),
          showPerformance: debugState.performance,
          scale: debugState.scale
        };

        this.debugRenderer.render(mountEl || this.renderer?.mountEl, resolvedModel.viewBox, debugOptions);
        console.log('[SystemsManager] ✅ Debug renderer completed');
      } catch (error) {
        console.error('[SystemsManager] ❌ Debug renderer failed:', error);
      }
    }

    // FIXED: Render control overlays with proper HASS context and error handling
    const controlOverlays = resolvedModel.overlays.filter(o => o.type === 'control');
    if (controlOverlays.length > 0) {
      console.log('[SystemsManager] Rendering control overlays:', controlOverlays.map(c => c.id));

      try {
        // Ensure controls renderer has current HASS context
        if (this._currentHass && this.controlsRenderer) {
          this.controlsRenderer.setHass(this._currentHass);
          console.log('[SystemsManager] HASS context applied to controls renderer');
        } else {
          console.warn('[SystemsManager] No HASS context available for controls');
        }

        // Wait for controls container to be ready
        const container = await this.controlsRenderer.ensureControlsContainerAsync();
        if (!container) {
          throw new Error('Controls container could not be created');
        }

        // Render controls
        await this.controlsRenderer.renderControls(controlOverlays, resolvedModel);
        console.log('[SystemsManager] ✅ Controls rendered successfully');

      } catch (error) {
        console.error('[SystemsManager] ❌ Controls rendering failed:', error);
        console.error('[SystemsManager] Error details:', error.stack);
      }
    }
  }

  /**
   * Check if debug should be rendered based on config
   * @param {Object} debugConfig - Debug configuration
   * @returns {boolean} Whether debug should be rendered
   */
  _shouldRenderDebugFromConfig(debugConfig) {
    if (!debugConfig || !debugConfig.overlays) return false;

    return debugConfig.overlays.anchors ||
          debugConfig.overlays.bounding_boxes ||
          debugConfig.overlays.routing ||
          debugConfig.overlays.performance;
  }

  /**
   * Legacy debug flag support (for backward compatibility)
   * @returns {Object} Debug flags
   */
  _getDebugFlags() {
    return window.cblcars?._debugFlags || {};
  }

  /**
   * Legacy debug check (for backward compatibility)
   * @param {Object} debugFlags - Debug flags
   * @returns {boolean} Whether debug should be rendered
   */
  _shouldRenderDebug(debugFlags) {
    return debugFlags && (debugFlags.overlay || debugFlags.connectors || debugFlags.geometry);
  }

  // Public API methods - now exclusively using DataSourceManager
  ingestHass(hass) {
    console.log('[SystemsManager] ingestHass called with:', {
      hasHass: !!hass,
      hasStates: !!hass?.states,
      entityCount: hass?.states ? Object.keys(hass.states).length : 0,
      hasLightDesk: !!hass?.states?.['light.desk'],
      lightDeskState: hass?.states?.['light.desk']?.state
    });

    if (!hass || !hass.states) {
      console.warn('[MSD v1] ingestHass called without valid hass.states');
      return;
    }

    // Store HASS context for controls renderer
    this._currentHass = hass;

    // ENHANCED: Pass HASS to controls renderer EVERY time to ensure cards get updates
    if (this.controlsRenderer) {
      console.log('[SystemsManager] Updating HASS context in controls renderer');
      this.controlsRenderer.setHass(hass);
    } else {
      console.warn('[SystemsManager] No controls renderer available for HASS update');
    }

    // DataSources handle HASS updates automatically via their subscriptions
    // No manual ingestion needed - handled by individual data sources
    console.log('[MSD v1] HASS ingestion handled by individual data sources');
  }

  updateEntities(map) {
    if (!map || typeof map !== 'object') return;

    console.log('[MSD v1] Manual entity updates not supported in DataSources system');
    console.warn('[MSD v1] Use direct HASS state updates instead of manual entity updates');
  }

  // Entity API methods using DataSourceManager
  listEntities() {
    return this.dataSourceManager ? this.dataSourceManager.listIds() : [];
  }

  getEntity(id) {
    return this.dataSourceManager ? this.dataSourceManager.getEntity(id) : null;
  }

  // ADDED: Setup global HUD interface for unified access
  _setupGlobalHudInterface() {
    const W = typeof window !== 'undefined' ? window : {};
    W.__msdDebug = W.__msdDebug || {};

    // Replace any legacy HUD interface with unified manager
    W.__msdDebug.hud = {
      show: () => this.hudManager?.show(),
      hide: () => this.hudManager?.hide(),
      toggle: () => this.hudManager?.toggle(),
      refresh: () => this.hudManager?.refresh(),
      setRefreshRate: (ms) => this.hudManager?.setRefreshRate(ms),

      // Legacy compatibility methods (no-op for smooth transition)
      registerPanel: () => console.warn('[HUD] Legacy registerPanel deprecated - use class-based panels'),
      publishIssue: () => console.warn('[HUD] Legacy publishIssue deprecated - panels auto-capture'),
      publishRouting: () => console.warn('[HUD] Legacy publishRouting deprecated - panels auto-capture'),
      publishRules: () => console.warn('[HUD] Legacy publishRules deprecated - panels auto-capture'),
      publishPacks: () => console.warn('[HUD] Legacy publishPacks deprecated - panels auto-capture'),
      publishPerf: () => console.warn('[HUD] Legacy publishPerf deprecated - panels auto-capture'),

      // Expose manager for advanced usage
      manager: this.hudManager
    };

    // ADDED: Auto-show if debug flags present
    try {
      if (W.cblcars?._debugFlags?.hud_auto || W.location?.search?.includes('hud=1')) {
        this.hudManager.show();
      }
    } catch (e) {
      console.warn('[SystemsManager] Auto-show HUD failed:', e);
    }

    console.log('[SystemsManager] Global HUD interface established');
  }
}
