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
    this._originalHass = null;  // Pristine copy for controls
    this._currentHass = null;   // Working copy for MSD internal processing
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
      return (changedIds, enhancedData = null) => {
          const timestamp = Date.now();

          console.log('[MSD DEBUG] 🔔 Entity change handler TRIGGERED:', {
              timestamp: new Date().toISOString(),
              changedIds,
              hasEnhancedData: !!enhancedData,
              stackTrace: new Error().stack.split('\n').slice(1, 5).join('\n'),
              renderTimeout: !!this._renderTimeout,
              renderInProgress: !!this._renderInProgress
          });

          // STEP 1: Handle controls with FRESH CURRENT HASS (restored logic)
          const controlEntities = this._extractControlEntities(this.mergedConfig);
          const controlChangedIds = changedIds.filter(id => controlEntities.includes(id));

          if (controlChangedIds.length > 0 && this.controlsRenderer) {
              // SIMPLIFIED: Direct subscription handles control updates automatically
              console.log('[SystemsManager] 📡 Control entities changed:', controlChangedIds);
              console.log('[SystemsManager] ℹ️ Direct subscription will handle these updates automatically');
              // NOTE: The direct HASS subscription automatically handles control updates
              // No need to manually forward HASS here as it causes duplicate/stale updates
          }

          // STEP 2: Update MSD internal HASS with converted data (existing logic)
          const workingHass = this.getCurrentHass();
          if (workingHass && this.dataSourceManager) {
              console.log('[MSD DEBUG] 📤 Refreshing MSD internal HASS context with converted entity states');

              // Get converted state from data source manager for MSD internal use
              const freshStates = {};
              changedIds.forEach(entityId => {
                  const entity = this.dataSourceManager.getEntity(entityId);
                  if (entity && entity.state !== undefined) {
                      // For MSD internal processing, use converted numeric values
                      freshStates[entityId] = {
                          state: entity.state.toString(), // MSD converted state
                          last_changed: new Date().toISOString(),
                          last_updated: new Date().toISOString(),
                          attributes: entity.attributes || workingHass.states[entityId]?.attributes || {},
                          entity_id: entityId,
                          context: {
                              id: Date.now().toString(),
                              user_id: null
                          }
                      };

                      console.log('[MSD DEBUG] 🔄 Updated MSD internal state for', entityId, {
                          originalState: this._originalHass?.states[entityId]?.state,
                          convertedState: freshStates[entityId].state,
                          rawValue: entity.state
                      });
                  } else {
                      console.log('[MSD DEBUG] ⚠️ No data source found for entity:', entityId, '(entity will not be updated in MSD internal HASS)');
                  }
              });

              // Only update HASS if we have fresh states from data sources
              if (Object.keys(freshStates).length > 0) {
                  // Update the working HASS states object with converted data
                  this._currentHass = {
                      ...workingHass,
                      states: {
                          ...workingHass.states,
                          ...freshStates
                      }
                  };

                  console.log('[MSD DEBUG] ✅ MSD internal HASS context refreshed with', Object.keys(freshStates).length, 'converted entities');
              } else {
                  console.log('[MSD DEBUG] ℹ️ No data source entities changed - MSD internal HASS unchanged');
              }
          } else {
              console.log('[MSD DEBUG] ⚠️ Skipping MSD internal HASS update:', {
                  hasWorkingHass: !!workingHass,
                  hasDataSourceManager: !!this.dataSourceManager,
                  dataSourceManagerIsNull: this.dataSourceManager === null
              });
          }

          // Mark rules dirty for future renders (only for entities with data sources)
          if (this.rulesEngine) {
              // Filter to only entities that have data sources
              const dataSourceEntities = changedIds.filter(entityId => {
                  return this.dataSourceManager && this.dataSourceManager.getEntity(entityId);
              });

              if (dataSourceEntities.length > 0) {
                  this.rulesEngine.markEntitiesDirty(dataSourceEntities);
                  console.log('[MSD DEBUG] 📏 Marked rules dirty for data source entities:', dataSourceEntities);
              } else {
                  console.log('[MSD DEBUG] 📏 No data source entities to mark dirty in rules engine');
              }
          } else {
              console.log('[MSD DEBUG] ⚠️ No rules engine available to mark dirty');
          }

          if (this._renderTimeout) {
              console.log('[MSD DEBUG] ⏰ Clearing existing render timeout');
              clearTimeout(this._renderTimeout);
          }

          // SIMPLIFIED: Check if this is ONLY a control-triggered change with no data source implications
          const isControlTriggered = changedIds.some(entityId => controlEntities.includes(entityId));
          const hasDataSourceChanges = changedIds.some(entityId => {
              return this.dataSourceManager && this.dataSourceManager.getEntity(entityId);
          });

          // Store analysis results
          this._lastEntityAnalysis = {
              isControlTriggered,
              hasDataSourceChanges,
              timestamp,
              changedIds,
              controlEntities,
              matchingEntities: changedIds.filter(id => controlEntities.includes(id))
          };

          console.log('[MSD DEBUG] 🎯 Entity change analysis:', this._lastEntityAnalysis);

          // Only skip re-render if it's ONLY controls AND no data source changes
          if (isControlTriggered && !hasDataSourceChanges) {
              console.log('[MSD DEBUG] ⏭️ SKIPPING re-render - only control entities changed (no data sources affected)');
          } else if (hasDataSourceChanges) {
              console.log('[MSD DEBUG] 🔄 Scheduling re-render for data source entity changes');

              // Safe re-render for data source changes
              this._renderTimeout = setTimeout(() => {
                  if (this._reRenderCallback && !this._renderInProgress) {
                      try {
                          this._renderInProgress = true;
                          console.log('[MSD DEBUG] 🚀 TRIGGERING re-render from data source entity change timeout');
                          this._reRenderCallback();
                      } catch (error) {
                          console.error('[MSD DEBUG] ❌ Re-render FAILED in entity change handler:', error);
                      } finally {
                          this._renderInProgress = false;
                      }
                  }
                  this._renderTimeout = null;
              }, 100);
          } else {
              console.log('[MSD DEBUG] ⏭️ SKIPPING re-render - no relevant entity changes for MSD');
          }
      };
  }



  /**
   * Set the original HASS object and keep a pristine reference for controls
   * @param {Object} hass - Original Home Assistant object
   */
  setOriginalHass(hass) {
      console.log('[SystemsManager] 📚 Setting original HASS reference:', {
          hasStates: !!hass?.states,
          entityCount: hass?.states ? Object.keys(hass.states).length : 0,
          hasAuth: !!hass?.auth,
          hasConnection: !!hass?.connection,
          lightDeskState: hass?.states?.['light.desk']?.state,
          timestamp: new Date().toISOString()
      });

      // ALWAYS update original HASS to keep it fresh - this should be the most current
      this._originalHass = hass;

      // If this is the first time setting HASS, also set working copy
      if (!this._currentHass) {
          this._currentHass = hass;
          console.log('[SystemsManager] 📚 Also setting _currentHass (first time)');
      }

      // ADDED: Set up direct subscription to ensure fresh HASS for controls
      this.setupDirectHassSubscription(hass);

      // Note: _currentHass will be modified separately in entity change handler with converted data
  }

  /**
   * Get the current working HASS (for MSD internal use)
   */
  getCurrentHass() {
      return this._currentHass;
  }

  /**
   * Get the original pristine HASS (for controls)
   */
  getOriginalHass() {
      return this._originalHass;
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

    // ENHANCED: Explicit-only data sources - no auto-creation
    const configuredDataSources = mergedConfig.data_sources || {};

    console.log('[MSD v1] 🔍 Using explicit-only data sources mode');
    console.log('[MSD v1] 🔍 Configured data sources:', Object.keys(configuredDataSources));

    // Controls use direct HASS - no data sources needed
    const controlEntities = this._extractControlEntities(mergedConfig);
    console.log('[MSD v1] 🔍 Control entities (using direct HASS):', controlEntities);

    // Use only explicitly configured data sources
    const allDataSources = { ...configuredDataSources };

    console.log('[MSD v1] 📊 Data source summary:', {
      configured: Object.keys(configuredDataSources).length,
      total: Object.keys(allDataSources).length,
      allDataSourceIds: Object.keys(allDataSources)
    });

    if (Object.keys(allDataSources).length === 0) {
      console.log('[MSD v1] No explicit data sources configured - DataSourceManager will not be initialized');
      console.log('[MSD v1] Note: Control overlays will use direct HASS (no data sources needed)');
      return;
    }

    console.log('[MSD v1] Initializing DataSourceManager with', Object.keys(allDataSources).length, 'explicit data sources');

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
      lightDeskState: hass?.states?.['light.desk']?.state,
      timestamp: new Date().toISOString()
    });

    if (!hass || !hass.states) {
      console.warn('[MSD v1] ingestHass called without valid hass.states');
      return;
    }

    // CRITICAL: Update BOTH working copy AND original copy to keep them fresh
    this._currentHass = hass;
    this._originalHass = hass;  // ADDED: Keep original fresh too

    console.log('[SystemsManager] Updated both _currentHass and _originalHass with fresh data');

    // ENHANCED: Pass HASS to controls renderer EVERY time to ensure cards get updates
    if (this.controlsRenderer) {
      console.log('[SystemsManager] Updating HASS context in controls renderer immediately');
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

  /**
   * Set up direct HASS subscription to ensure fresh HASS for controls
   * @param {Object} hass - Home Assistant object with connection
   */
  setupDirectHassSubscription(hass) {
    if (hass && hass.connection && !this._directHassSubscription) {
      console.log('[SystemsManager] 🔗 Setting up direct HASS subscription for fresh control updates');

      this._directHassSubscription = hass.connection.subscribeEvents((event) => {
        if (event.event_type === 'state_changed' && event.data && event.data.entity_id) {
          const entityId = event.data.entity_id;
          const newState = event.data.new_state;

          // Check if this is a control entity
          const controlEntities = this._extractControlEntities(this.mergedConfig);
          if (controlEntities.includes(entityId) && newState) {
            console.log('[SystemsManager] 📡 Direct HASS update for control entity:', entityId, 'new state:', newState.state);

            // Update our HASS with the fresh state
            if (this._originalHass && this._originalHass.states) {
              const freshHass = {
                ...this._originalHass,
                states: {
                  ...this._originalHass.states,
                  [entityId]: newState
                }
              };

              console.log('[SystemsManager] 📊 Updated HASS with fresh state for', entityId, ':', newState.state);
              this._originalHass = freshHass;
              this._currentHass = freshHass;

              // Forward fresh HASS to controls immediately
              if (this.controlsRenderer) {
                console.log('[SystemsManager] 📤 Immediately forwarding fresh HASS to controls');
                this.controlsRenderer.setHass(freshHass);
              }
            }
          }
        }
      }, 'state_changed');

            console.log('[SystemsManager] ✅ Direct HASS subscription established');
    }
  }

  /**
   * Set up global HUD interface (placeholder for future implementation)
   * @private
   */
  _setupGlobalHudInterface() {
    console.log('[SystemsManager] Global HUD interface setup completed');
    // This method is called during initialization
    // Future HUD interface setup will go here
  }
}

