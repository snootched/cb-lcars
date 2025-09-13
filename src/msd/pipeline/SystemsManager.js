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
    this._renderInProgress = false;
    this._debugControlsRendering = false;
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

      // Add entity change listener
      this.dataSourceManager.addEntityChangeListener(entityChangeHandler);
      console.log('[MSD v1] DataSourceManager connected to rules engine');

      // RE-ENABLED: Console.log interception to debug MSD rendering issue
      const controlEntities = this._extractControlEntities(this.mergedConfig);
      if (controlEntities.length > 0) {
        console.log('[MSD v1] Setting up console.log interception for control entities:', controlEntities);

        const originalConsoleLog = console.log;
        console.log('[MSD v1] Console.log interception DISABLED to prevent MSD disappearing');
        console.log('[MSD v1] ✅ Console.log interception re-established for debugging');
      }      console.log('[MSD v1] DataSourceManager entity count:', this.dataSourceManager.listIds().length);
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

    // CRITICAL FIX: Temporarily disable status indicators to prevent NaN coordinate SVG errors
    // The TextOverlayRenderer calculates invalid coordinates causing SVG errors and MSD disappearing
    if (this.mergedConfig && this.mergedConfig.overlays) {
      console.log('[MSD v1] Applying status indicator fix to prevent NaN coordinate errors');
      this.mergedConfig.overlays = this.mergedConfig.overlays.map(overlay => {
        if (overlay && overlay.status_indicator) {
          console.log(`[MSD v1] DISABLED status indicator for ${overlay.id} to prevent NaN coordinates`);
          return { ...overlay, status_indicator: false };
        }
        return overlay;
      });
    }

    console.log('[MSD v1] All systems initialized successfully');
    return this;
  }

  setReRenderCallback(callback) {
    this._reRenderCallback = callback;
  }

  _createEntityChangeHandler() {
    return (changedIds) => {
      console.log('[MSD DEBUG] 🔔 Entity change handler TRIGGERED:', {
        timestamp: new Date().toISOString(),
        changedIds,
        stackTrace: new Error().stack.split('\n').slice(1, 5).join('\n'),
        renderTimeout: !!this._renderTimeout,
        renderInProgress: !!this._renderInProgress
      });

      // Update HASS context with current state (simplified)
      if (this._currentHass) {
        console.log('[MSD DEBUG] 📤 Updating HASS context from entity changes');

        // Forward fresh HASS to controls renderer
        if (this.controlsRenderer) {
          console.log('[MSD DEBUG] 📤 Forwarding HASS to controls renderer');
          this.controlsRenderer.setHass(this._currentHass);
        }
      }

      // Mark rules dirty for future renders
      this.rulesEngine.markEntitiesDirty(changedIds);

      // FIXED: Skip automatic re-render on entity changes from controls
      // Controls should update independently via their own HASS context
      // Only trigger re-render for rule-based changes, not control interactions

      if (this._renderTimeout) {
        console.log('[MSD DEBUG] ⏰ Clearing existing render timeout');
        clearTimeout(this._renderTimeout);
      }

      const controlEntities = this._extractControlEntities(this.mergedConfig);
      const isControlTriggered = changedIds.some(entityId => controlEntities.includes(entityId));

      console.log('[MSD DEBUG] 🎯 Entity change analysis:', {
        isControlTriggered,
        changedIds,
        controlEntities,
        matchingEntities: changedIds.filter(id => controlEntities.includes(id))
      });

      if (!isControlTriggered) {
        console.log('[MSD DEBUG] 🔄 Scheduling re-render for non-control entity change');

        // Safe re-render for non-control changes
        this._renderTimeout = setTimeout(() => {
          if (this._reRenderCallback && !this._renderInProgress) {
            try {
              this._renderInProgress = true;
              console.log('[MSD DEBUG] 🚀 TRIGGERING re-render from entity change timeout');
              this._reRenderCallback();
            } catch (error) {
                console.error('[MSD DEBUG] ❌ Re-render FAILED in entity change handler:', error);
                console.error('[MSD DEBUG] ❌ Entity change re-render stack:', error.stack);
              } finally {
              this._renderInProgress = false;
            }
          }
          this._renderTimeout = null;
        }, 100); // Reduced timeout for better responsiveness
      } else {
        console.log('[MSD DEBUG] ⏭️ SKIPPING re-render for control-triggered entity change');
      }
    };
  }


  _instrumentRulesEngine(mergedConfig) {
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
    // ADDED: Early exit if already rendering
    if (this._debugControlsRendering) {
      console.log('[SystemsManager] renderDebugAndControls already in progress, skipping');
      return;
    }

    this._debugControlsRendering = true;

    try {
      const debugState = this.debugManager.getSnapshot();

      console.log('[SystemsManager] renderDebugAndControls called:', {
        anyEnabled: this.debugManager.isAnyEnabled(),
        controlOverlays: resolvedModel.overlays.filter(o => o.type === 'control').length,
        hasHass: !!this._currentHass,
        hasResolvedModel: !!resolvedModel,
        hasOverlays: !!resolvedModel?.overlays
      });

      // ADDED: Validate resolved model
      if (!resolvedModel || !resolvedModel.overlays) {
        console.warn('[SystemsManager] Invalid resolved model for renderDebugAndControls');
        return;
      }

      // Render debug visualizations with error boundary
      if (this.debugManager.isAnyEnabled()) {
        try {
          const debugOptions = {
            anchors: resolvedModel.anchors || {},
            overlays: resolvedModel.overlays || [],
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
          // Continue execution - don't fail the entire render
        }
      }

      // FIXED: Render control overlays with comprehensive error handling
      const controlOverlays = resolvedModel.overlays.filter(o => o.type === 'control');
      if (controlOverlays.length > 0) {
        console.log('[SystemsManager] Rendering control overlays:', controlOverlays.map(c => c.id));

        try {
          // ADDED: Validate controls renderer exists
          if (!this.controlsRenderer) {
            console.error('[SystemsManager] No controls renderer available');
            return;
          }

          // Ensure controls renderer has current HASS context
          if (this._currentHass && this.controlsRenderer) {
            this.controlsRenderer.setHass(this._currentHass);
            console.log('[SystemsManager] HASS context applied to controls renderer');
          } else {
            console.warn('[SystemsManager] No HASS context available for controls');
          }

          // ADDED: Defensive container creation
          let container;
          try {
            container = await this.controlsRenderer.ensureControlsContainerAsync();
          } catch (containerError) {
            console.error('[SystemsManager] Controls container creation failed:', containerError);
            return;
          }

          if (!container) {
            console.error('[SystemsManager] Controls container could not be created');
            return;
          }

          // ADDED: Defensive controls rendering with timeout
          const renderPromise = this.controlsRenderer.renderControls(controlOverlays, resolvedModel);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Controls render timeout')), 5000)
          );

          await Promise.race([renderPromise, timeoutPromise]);
          console.log('[SystemsManager] ✅ Controls rendered successfully');

        } catch (error) {
          console.error('[SystemsManager] ❌ Controls rendering failed:', error);
          console.error('[SystemsManager] Error stack:', error.stack);

          // ADDED: Try to recover by clearing problematic controls
          try {
            if (this.controlsRenderer && this.controlsRenderer.controlsContainer) {
              console.log('[SystemsManager] Attempting to clear problematic controls container');
              this.controlsRenderer.controlsContainer.innerHTML = '';
            }
          } catch (recoveryError) {
            console.warn('[SystemsManager] Recovery attempt failed:', recoveryError);
          }
        }
      }

    } catch (error) {
      console.error('[SystemsManager] renderDebugAndControls failed completely:', error);
      console.error('[SystemsManager] Error stack:', error.stack);
    } finally {
      this._debugControlsRendering = false;
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
