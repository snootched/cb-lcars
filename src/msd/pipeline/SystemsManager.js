import { AdvancedRenderer } from '../renderer/AdvancedRenderer.js';
import { MsdDebugRenderer } from '../debug/MsdDebugRenderer.js';
import { MsdControlsRenderer } from '../controls/MsdControlsRenderer.js';
import { MsdHudManager } from '../hud/MsdHudManager.js';
import { DataSourceManager } from '../data/DataSourceManager.js';
import { RouterCore } from '../routing/RouterCore.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { AnimationRegistry } from '../animation/AnimationRegistry.js';

import { RulesEngine } from '../rules/RulesEngine.js';
import { DebugManager } from '../debug/DebugManager.js';
import { BaseOverlayUpdater } from '../renderer/BaseOverlayUpdater.js';

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
    this.overlayUpdater = null; // ADDED: Unified overlay update system
    this._renderTimeout = null;
    this._reRenderCallback = null;
    this._queuedReRender = false; // ADDED: Flag for queued renders
    this._debugControlsRendering = false;
    this.mergedConfig = null; // Store for entity change handler
    this._originalHass = null;  // Pristine copy for controls
    this._currentHass = null;   // Working copy for MSD internal processing
    this._previousRuleStates = new Map(); // ADDED: Track rule states for threshold crossing detection

    // ADDED: Render progress tracking with automatic queue execution
    this._internalRenderInProgress = false;
    Object.defineProperty(this, '_renderInProgress', {
      get() {
        return this._internalRenderInProgress;
      },
      set(value) {
        const oldValue = this._internalRenderInProgress;
        this._internalRenderInProgress = value;

        // CRITICAL FIX: Execute queued render when render completes (true → false)
        if (oldValue === true && value === false && this._queuedReRender) {
          console.debug('[SystemsManager] 🔄 Executing queued re-render (render completed)');
          this._queuedReRender = false;

          setTimeout(() => {
            if (!this._internalRenderInProgress && this._reRenderCallback) {
              console.debug('[SystemsManager] 🚀 Executing queued re-render callback');
              try {
                this._reRenderCallback();
              } catch (error) {
                console.error('[SystemsManager] ❌ Queued re-render failed:', error);
              }
            }
          }, 50);
        }
      }
    });
  }

  async initializeSystems(mergedConfig, cardModel, mountEl, hass) {
    console.debug('[SystemsManager] Initializing runtime systems');

    // Store config for later use
    this.mergedConfig = mergedConfig;

    // ADDED: Store HASS context immediately
    this._currentHass = hass;

    // ENHANCED: Initialize debug manager early with config and better logging
    const debugConfig = mergedConfig.debug || {};
    console.debug('[SystemsManager] Raw debug config from mergedConfig:', debugConfig);

    this.debugManager.init(debugConfig);
    console.debug('[SystemsManager] DebugManager initialized with config:', debugConfig);

    // Initialize data source manager FIRST
    await this._initializeDataSources(hass, mergedConfig);

    // Initialize rules engine AFTER DataSourceManager with proper connection
    this.rulesEngine = new RulesEngine(mergedConfig.rules, this.dataSourceManager);
    this.rulesEngine.markAllDirty();
    this._instrumentRulesEngine(mergedConfig);

    // Connect data source manager to rules engine for entity changes
    if (this.dataSourceManager) {
      const entityChangeHandler = this._createEntityChangeHandler();

      // Add entity change listener
      this.dataSourceManager.addEntityChangeListener(entityChangeHandler);
      console.debug('[SystemsManager] DataSourceManager connected to rules engine with entity change handler');

      console.debug('[SystemsManager] DataSourceManager entity count:', this.dataSourceManager.listIds().length);
    } else {
      console.warn('[SystemsManager] DataSourceManager not initialized - no data sources configured or HASS unavailable');
    }

    // Initialize rendering systems
    this.router = new RouterCore(mergedConfig.routing, cardModel.anchors, cardModel.viewBox);
    this.renderer = new AdvancedRenderer(mountEl, this.router, this); // ADDED: Pass 'this' as systemsManager
    this.debugRenderer = new MsdDebugRenderer();
    this.controlsRenderer = new MsdControlsRenderer(this.renderer);

    // ADDED: Set HASS context on controls renderer immediately if available
    if (this._currentHass && this.controlsRenderer) {
      console.debug('[SystemsManager] Setting initial HASS context on controls renderer');
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
    console.debug('[SystemsManager] RouterCore marked ready for debug system');

    // Initialize animation registry
    this.animRegistry = new AnimationRegistry();

    // ADDED: Initialize unified overlay update system
    this.overlayUpdater = new BaseOverlayUpdater(this);
    console.debug('[SystemsManager] BaseOverlayUpdater initialized for unified overlay updates');

    // CRITICAL FIX: Temporarily disable status indicators to prevent NaN coordinate SVG errors
    // The TextOverlayRenderer calculates invalid coordinates causing SVG errors and MSD disappearing
    if (this.mergedConfig && this.mergedConfig.overlays) {
      console.debug('[SystemsManager] Applying status indicator fix to prevent NaN coordinate errors');
      this.mergedConfig.overlays = this.mergedConfig.overlays.map(overlay => {
        if (overlay && overlay.status_indicator) {
          console.debug(`[SystemsManager] DISABLED status indicator for ${overlay.id} to prevent NaN coordinates`);
          return { ...overlay, status_indicator: false };
        }
        return overlay;
      });
    }

    console.debug('[SystemsManager] All systems initialized successfully');
    return this;
  }

  setReRenderCallback(callback) {
    this._reRenderCallback = callback;
  }



  _createEntityChangeHandler() {
      return (changedIds, enhancedData = null) => {
          const timestamp = Date.now();

          console.debug('[SystemsManager] 🔔 Entity change handler TRIGGERED:', {
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
              console.debug('[SystemsManager] 📡 Control entities changed:', controlChangedIds);
              console.debug('[SystemsManager] ℹ️ Direct subscription will handle these updates automatically');
              // NOTE: The direct HASS subscription automatically handles control updates
              // No need to manually forward HASS here as it causes duplicate/stale updates
          }

          // STEP 2: Update MSD internal HASS with converted data (existing logic)
          const workingHass = this.getCurrentHass();
          if (workingHass && this.dataSourceManager) {
              console.debug('[SystemsManager] 📤 Refreshing MSD internal HASS context with converted entity states');

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

                      console.debug('[SystemsManager] 🔄 Updated MSD internal state for', entityId, {
                          originalState: this._originalHass?.states[entityId]?.state,
                          convertedState: freshStates[entityId].state,
                          rawValue: entity.state
                      });
                  } else {
                      console.debug('[SystemsManager] ⚠️ No data source found for entity:', entityId, '(entity will not be updated in MSD internal HASS)');
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

                  console.debug('[SystemsManager] ✅ MSD internal HASS context refreshed with', Object.keys(freshStates).length, 'converted entities');
              } else {
                  console.debug('[SystemsManager] ℹ️ No data source entities changed - MSD internal HASS unchanged');
              }
          } else {
              console.debug('[SystemsManager] ⚠️ Skipping MSD internal HASS update:', {
                  hasWorkingHass: !!workingHass,
                  hasDataSourceManager: !!this.dataSourceManager,
                  dataSourceManagerIsNull: this.dataSourceManager === null
              });
          }

          // STEP 2.5: ENHANCED - Update overlays with DataSource changes using unified system
          if (this.overlayUpdater) {
              console.debug('[SystemsManager] 🔄 Using BaseOverlayUpdater for overlay updates');
              this.overlayUpdater.updateOverlaysForDataSourceChanges(changedIds);
          } else {
              console.debug('[SystemsManager] ⚠️ BaseOverlayUpdater not available, skipping overlay updates');
          }

          // Mark rules dirty for future renders
          if (this.rulesEngine) {
              // Enhanced: Map entity IDs to DataSource IDs for rules
              const entitiesToMarkDirty = new Set();

              changedIds.forEach(entityId => {
                  // Add the original entity ID
                  entitiesToMarkDirty.add(entityId);

                  // Check if this entity ID corresponds to any DataSources
                  if (this.dataSourceManager) {
                      // Find DataSources that use this entity
                      for (const [sourceId, source] of this.dataSourceManager.sources) {
                          if (source.cfg && source.cfg.entity === entityId) {
                              // Add the DataSource ID so rules can be triggered
                              entitiesToMarkDirty.add(sourceId);
                              console.debug(`[SystemsManager] 📏 Mapped entity "${entityId}" to DataSource "${sourceId}"`);
                          }
                      }
                  }
              });

              const finalEntityList = Array.from(entitiesToMarkDirty);
              this.rulesEngine.markEntitiesDirty(finalEntityList);
              console.debug('[SystemsManager] 📏 Marked rules dirty for entities:', finalEntityList);
          } else {
              console.debug('[SystemsManager] ⚠️ No rules engine available to mark dirty');
          }

          if (this._renderTimeout) {
              console.debug('[SystemsManager] ⏰ Clearing existing render timeout');
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

          console.debug('[SystemsManager] 🎯 Entity change analysis:', this._lastEntityAnalysis);

          // IMPROVED: Only trigger re-render if rules might have actually changed
          if (hasDataSourceChanges) {
              console.debug('[SystemsManager] 🔄 Checking if rules need re-evaluation for data source changes');

              // Check if rule conditions might have changed
              const needsRuleReRender = this._checkIfRulesNeedReRender(changedIds);

              if (needsRuleReRender) {
                  console.debug('[SystemsManager] 🎨 Rule conditions may have changed - scheduling full re-render');
                  this._scheduleFullReRender();
              } else {
                  console.debug('[SystemsManager] 📊 Only content changed - rules unchanged, skipping full re-render');
                  // Content updates happen automatically via DataSource subscriptions
                  // No full re-render needed for content-only changes
              }
          } else {
              console.debug('[SystemsManager] ⏭️ SKIPPING re-render - no relevant entity changes for MSD');
          }
      };
  }



  /**
   * Set the original HASS object and keep a pristine reference for controls
   * @param {Object} hass - Original Home Assistant object
   */
  setOriginalHass(hass) {
      console.debug('[SystemsManager] 📚 Setting original HASS reference:', {
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
          console.debug('[SystemsManager] 📚 Also setting _currentHass (first time)');
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
      console.warn('[SystemsManager][rules instrumentation] failed', e);
    }
  }

  async _initializeDataSources(hass, mergedConfig) {
    this.dataSourceManager = null;

    // ENHANCED: Better logging and error handling
    if (!hass) {
      console.warn('[SystemsManager] No HASS provided - DataSourceManager will not be initialized');
      return;
    }

    // ENHANCED: Explicit-only data sources - no auto-creation
    const configuredDataSources = mergedConfig.data_sources || {};

    console.debug('[SystemsManager] 🔍 Using explicit-only data sources mode');
    console.debug('[SystemsManager] 🔍 Configured data sources:', Object.keys(configuredDataSources));

    // Controls use direct HASS - no data sources needed
    const controlEntities = this._extractControlEntities(mergedConfig);
    console.debug('[SystemsManager] 🔍 Control entities (using direct HASS):', controlEntities);

    // Use only explicitly configured data sources
    const allDataSources = { ...configuredDataSources };

    console.debug('[SystemsManager] 📊 Data source summary:', {
      configured: Object.keys(configuredDataSources).length,
      total: Object.keys(allDataSources).length,
      allDataSourceIds: Object.keys(allDataSources)
    });

    if (Object.keys(allDataSources).length === 0) {
      console.debug('[SystemsManager] No explicit data sources configured - DataSourceManager will not be initialized');
      console.debug('[SystemsManager] Note: Control overlays will use direct HASS (no data sources needed)');
      return;
    }

    console.debug('[SystemsManager] Initializing DataSourceManager with', Object.keys(allDataSources).length, 'explicit data sources');

    try {
      this.dataSourceManager = new DataSourceManager(hass);
      const sourceCount = await this.dataSourceManager.initializeFromConfig(allDataSources);
      console.debug('[SystemsManager] ✅ DataSourceManager initialized -', sourceCount, 'sources started');

      // ADDED: Verify entities are available
      const entityIds = this.dataSourceManager.listIds();
      console.debug('[SystemsManager] ✅ DataSourceManager entities available:', entityIds);

    } catch (error) {
      console.error('[SystemsManager] ❌ DataSourceManager initialization failed:', error);
      console.error('[SystemsManager] Error details:', error.stack);
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
      console.debug('[SystemsManager] renderDebugAndControls already in progress, skipping');
      return;
    }

    this._debugControlsRendering = true;

    try {
      const debugState = this.debugManager.getSnapshot();

      console.debug('[SystemsManager] renderDebugAndControls called:', {
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
          console.debug('[SystemsManager] ✅ Debug renderer completed');
        } catch (error) {
          console.error('[SystemsManager] ❌ Debug renderer failed:', error);
          // Continue execution - don't fail the entire render
        }
      }

      // FIXED: Render control overlays with comprehensive error handling
      const controlOverlays = resolvedModel.overlays.filter(o => o.type === 'control');
      if (controlOverlays.length > 0) {
        console.debug('[SystemsManager] Rendering control overlays:', controlOverlays.map(c => c.id));

        try {
          // ADDED: Validate controls renderer exists
          if (!this.controlsRenderer) {
            console.error('[SystemsManager] No controls renderer available');
            return;
          }

          // Ensure controls renderer has current HASS context
          if (this._currentHass && this.controlsRenderer) {
            this.controlsRenderer.setHass(this._currentHass);
            console.debug('[SystemsManager] HASS context applied to controls renderer');
          } else {
            console.warn('[SystemsManager] No HASS context available for controls');
          }

          // REMOVED: Defensive container creation - not needed with SVG foreignObject approach
          // The renderControls() method handles all necessary container creation internally

          // ADDED: Defensive controls rendering with timeout
          const renderPromise = this.controlsRenderer.renderControls(controlOverlays, resolvedModel);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Controls render timeout')), 5000)
          );

          await Promise.race([renderPromise, timeoutPromise]);
          console.debug('[SystemsManager] ✅ Controls rendered successfully');

        } catch (error) {
          console.error('[SystemsManager] ❌ Controls rendering failed:', error);
          console.error('[SystemsManager] Error stack:', error.stack);
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
    console.debug('[SystemsManager] ingestHass called with:', {
      hasHass: !!hass,
      hasStates: !!hass?.states,
      entityCount: hass?.states ? Object.keys(hass.states).length : 0,
      hasLightDesk: !!hass?.states?.['light.desk'],
      lightDeskState: hass?.states?.['light.desk']?.state,
      timestamp: new Date().toISOString()
    });

    if (!hass || !hass.states) {
      console.warn('[SystemsManager] ingestHass called without valid hass.states');
      return;
    }

    // CRITICAL: Update BOTH working copy AND original copy to keep them fresh
    this._currentHass = hass;
    this._originalHass = hass;  // ADDED: Keep original fresh too

    console.debug('[SystemsManager] Updated both _currentHass and _originalHass with fresh data');

    // ENHANCED: Pass HASS to controls renderer EVERY time to ensure cards get updates
    if (this.controlsRenderer) {
      console.debug('[SystemsManager] Updating HASS context in controls renderer immediately');
      this.controlsRenderer.setHass(hass);
    } else {
      console.warn('[SystemsManager] No controls renderer available for HASS update');
    }

    // DataSources handle HASS updates automatically via their subscriptions
    // No manual ingestion needed - handled by individual data sources
    console.debug('[SystemsManager] HASS ingestion handled by individual data sources');
  }

  updateEntities(map) {
    if (!map || typeof map !== 'object') return;

    console.debug('[SystemsManager] Manual entity updates not supported in DataSources system');
    console.warn('[SystemsManager] Use direct HASS state updates instead of manual entity updates');
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
      console.debug('[SystemsManager] 🔗 Setting up direct HASS subscription for fresh control updates');

      this._directHassSubscription = hass.connection.subscribeEvents((event) => {
        if (event.event_type === 'state_changed' && event.data && event.data.entity_id) {
          const entityId = event.data.entity_id;
          const newState = event.data.new_state;

          // Check if this is a control entity
          const controlEntities = this._extractControlEntities(this.mergedConfig);
          if (controlEntities.includes(entityId) && newState) {
            console.debug('[SystemsManager] 📡 Direct HASS update for control entity:', entityId, 'new state:', newState.state);

            // Update our HASS with the fresh state
            if (this._originalHass && this._originalHass.states) {
              const freshHass = {
                ...this._originalHass,
                states: {
                  ...this._originalHass.states,
                  [entityId]: newState
                }
              };

              console.debug('[SystemsManager] 📊 Updated HASS with fresh state for', entityId, ':', newState.state);
              this._originalHass = freshHass;
              this._currentHass = freshHass;

              // Forward fresh HASS to controls immediately
              if (this.controlsRenderer) {
                console.debug('[SystemsManager] 📤 Immediately forwarding fresh HASS to controls');
                this.controlsRenderer.setHass(freshHass);
              }
            }
          }
        }
      }, 'state_changed');

            console.debug('[SystemsManager] ✅ Direct HASS subscription established');
    }
  }

  /**
   * Set up global HUD interface (placeholder for future implementation)
   * @private
   */
  _setupGlobalHudInterface() {
    console.debug('[SystemsManager] Global HUD interface setup completed');
    // This method is called during initialization
    // Future HUD interface setup will go here
  }

  /**
   * Check if entity changes might affect rule conditions (requiring full re-render)
   * @param {Array} changedIds - Entity IDs that changed
   * @returns {boolean} True if rules might need re-evaluation
   * @private
   */
  _checkIfRulesNeedReRender(changedIds) {
    if (!this.rulesEngine || !this.mergedConfig?.rules) {
      return false; // No rules to evaluate
    }

    // For now, be conservative and assume any DataSource change might affect rules
    // TODO: In the future, we could be more sophisticated and check specific rule conditions
    const affectedDataSources = changedIds.filter(id => {
      // Check if this entity maps to a DataSource used in rules
      return this.dataSourceManager?.getEntity(id) ||
             changedIds.some(entityId => this.dataSourceManager?.getSource(entityId));
    });

    if (affectedDataSources.length > 0) {
      console.debug('[SystemsManager] 🎯 DataSource entities affected by changes:', affectedDataSources);

      // ADVANCED: Check if the specific rule thresholds might be crossed
      // This is where we could add more sophisticated logic to detect actual rule changes
      const mightCrossThresholds = this._checkThresholdCrossing(changedIds);

      console.debug('[SystemsManager] 🌡️ Threshold crossing check:', mightCrossThresholds);
      return mightCrossThresholds;
    }

    return false;
  }

  /**
   * Check if entity changes might cross rule thresholds
   * @param {Array} changedIds - Entity IDs that changed
   * @returns {boolean} True if thresholds might be crossed
   * @private
   */
  _checkThresholdCrossing(changedIds) {
    // For temperature example: check if we're crossing the 70°F threshold
    const rules = this.mergedConfig.rules || [];

    for (const rule of rules) {
      const conditions = rule.when?.any || rule.when?.all || [];

      for (const condition of conditions) {
        if (condition.entity && (condition.above !== undefined || condition.below !== undefined)) {
          // Check if this entity or its DataSource is in changedIds
          const entityInRule = condition.entity;
          const isDataSourceAffected = changedIds.some(id => {
            // Check if changed entity maps to the DataSource used in the rule
            const dataSourceId = entityInRule.split('.')[0]; // e.g., "temperature_enhanced"
            const source = this.dataSourceManager?.getSource(dataSourceId);
            return source && source.cfg?.entity === id;
          });

          if (isDataSourceAffected) {
            console.debug('[SystemsManager] 🎯 Rule condition potentially affected:', {
              rule: rule.id,
              entity: entityInRule,
              threshold: condition.above || condition.below,
              operator: condition.above ? 'above' : 'below'
            });

            // IMPROVED: Check actual threshold crossing instead of always returning true
            const currentEntity = this.dataSourceManager?.getEntity(entityInRule);
            if (currentEntity && currentEntity.state !== undefined) {
              const currentValue = parseFloat(currentEntity.state);
              const threshold = condition.above || condition.below;
              const isAboveThreshold = currentValue > threshold;
              const isBelowThreshold = currentValue < threshold;

              // Check if current value satisfies the condition
              const currentlyMatches = condition.above ? isAboveThreshold : isBelowThreshold;

              console.debug('[SystemsManager] 🌡️ Detailed threshold analysis:', {
                currentValue,
                threshold,
                operator: condition.above ? 'above' : 'below',
                isAboveThreshold,
                isBelowThreshold,
                currentlyMatches,
                ruleId: rule.id
              });

              // Store the current rule state for next comparison
              if (!this._previousRuleStates) {
                this._previousRuleStates = new Map();
              }

              const ruleKey = `${rule.id}_${condition.entity}`;
              const previouslyMatched = this._previousRuleStates.get(ruleKey);

              console.debug('[SystemsManager] 📊 Rule state comparison:', {
                ruleKey,
                previouslyMatched,
                currentlyMatches,
                stateChanged: previouslyMatched !== currentlyMatches
              });

              // Update the stored state
              this._previousRuleStates.set(ruleKey, currentlyMatches);

              // Only trigger re-render if the rule state actually changed
              if (previouslyMatched !== undefined && previouslyMatched !== currentlyMatches) {
                console.debug('[SystemsManager] 🔄 Rule state CHANGED - threshold crossing detected!');
                return true;
              } else if (previouslyMatched === undefined) {
                console.debug('[SystemsManager] 🆕 First rule evaluation - storing state');
                // First time seeing this rule, don't trigger re-render
                return false;
              } else {
                console.debug('[SystemsManager] 📌 Rule state UNCHANGED - no threshold crossing');
                return false;
              }
            }
          }
        }
      }
    }

    console.debug('[SystemsManager] 📊 No threshold crossings detected');
    return false;
  }  /**
   * Schedule a full re-render with proper queuing
   * @private
   */
  _scheduleFullReRender() {
    if (this._renderTimeout) {
      console.debug('[SystemsManager] ⏰ Clearing existing render timeout');
      clearTimeout(this._renderTimeout);
    }

    // Safe re-render for data source changes
    this._renderTimeout = setTimeout(() => {
      if (this._reRenderCallback && !this._renderInProgress) {
        try {
          this._renderInProgress = true;
          console.debug('[SystemsManager] 🚀 TRIGGERING full re-render from rule change timeout');
          this._reRenderCallback();
        } catch (error) {
          console.error('[SystemsManager] ❌ Re-render FAILED in entity change handler:', error);
        } finally {
          this._renderInProgress = false;
        }
      }
      this._renderTimeout = null;
    }, 100);
  }

  /**
   * Update text overlays when DataSource entities change
   * @param {Array} changedIds - Entity IDs that changed
   * @private
   */
  _updateTextOverlaysForDataSourceChanges(changedIds) {
    console.debug('[SystemsManager] 🔤 Checking for text overlays affected by DataSource changes:', changedIds);

    // Get current resolved model to find text overlays
    const resolvedModel = this.modelBuilder?.getResolvedModel?.();
    if (!resolvedModel || !resolvedModel.overlays) {
      console.debug('[SystemsManager] ⚠️ No resolved model available for text overlay updates');
      return;
    }

    // Find text overlays that might be affected
    const textOverlays = resolvedModel.overlays.filter(overlay => overlay.type === 'text');
    console.debug('[SystemsManager] 🔤 Found', textOverlays.length, 'text overlays to check');

    textOverlays.forEach(overlay => {
      // Check if this text overlay uses template strings that reference the changed DataSources
      const content = overlay._raw?.content || overlay.content || overlay.text || '';

      if (content && typeof content === 'string' && content.includes('{')) {
        console.debug(`[SystemsManager] 🔤 Checking text overlay ${overlay.id} with content: "${content}"`);

        // Check if any of the changed entities map to DataSources referenced in the template
        const needsUpdate = changedIds.some(entityId => {
          // Find DataSources that use this entity
          if (this.dataSourceManager) {
            for (const [sourceId, source] of this.dataSourceManager.sources || new Map()) {
              if (source.cfg && source.cfg.entity === entityId) {
                console.debug(`[SystemsManager] 🔗 Entity ${entityId} maps to DataSource ${sourceId}`);

                // Check if the template content references this DataSource
                if (content.includes(sourceId)) {
                  console.debug(`[SystemsManager] ✅ Text overlay ${overlay.id} references DataSource ${sourceId} - needs update`);
                  return true;
                }
              }
            }
          }
          return false;
        });

        if (needsUpdate) {
          console.debug(`[SystemsManager] 🚀 Updating text overlay ${overlay.id} for DataSource changes`);

          // Get the updated DataSource data for the first changed DataSource
          const updatedDataSourceId = this._findDataSourceForEntity(changedIds[0]);
          if (updatedDataSourceId) {
            const dataSource = this.dataSourceManager.getSource(updatedDataSourceId);
            if (dataSource) {
              const currentData = dataSource.getCurrentData();
              console.debug(`[SystemsManager] 📊 Using DataSource ${updatedDataSourceId} data:`, currentData);

              // Update the text overlay with new data
              if (this.renderer && this.renderer.updateTextOverlay) {
                try {
                  this.renderer.updateTextOverlay(overlay.id, currentData);
                  console.debug(`[SystemsManager] ✅ Text overlay ${overlay.id} updated successfully`);
                } catch (error) {
                  console.error(`[SystemsManager] ❌ Failed to update text overlay ${overlay.id}:`, error);
                }
              }
            }
          }
        } else {
          console.debug(`[SystemsManager] ⏭️ Text overlay ${overlay.id} not affected by these changes`);
        }
      }
    });
  }

  /**
   * Find DataSource ID for a given entity ID
   * @param {string} entityId - Entity ID
   * @returns {string|null} DataSource ID
   * @private
   */
  _findDataSourceForEntity(entityId) {
    if (this.dataSourceManager) {
      for (const [sourceId, source] of this.dataSourceManager.sources || new Map()) {
        if (source.cfg && source.cfg.entity === entityId) {
          return sourceId;
        }
      }
    }
    return null;
  }
}

// CLEANUP NOTE: The old text-specific overlay update methods have been removed
  // and replaced with the unified BaseOverlayUpdater system in BaseOverlayUpdater.js
  // This provides consistent template processing across all overlay types.

