import { AdvancedRenderer } from '../renderer/AdvancedRenderer.js';
import { MsdDebugRenderer } from '../debug/MsdDebugRenderer.js';
import { MsdControlsRenderer } from '../controls/MsdControlsRenderer.js';
import { MsdHudManager } from '../hud/MsdHudManager.js';
import { DataSourceManager } from '../data/DataSourceManager.js';
import { RouterCore } from '../routing/RouterCore.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { AnimationRegistry } from '../animation/AnimationRegistry.js';
import { ThemeManager } from '../themes/ThemeManager.js';
import { RulesEngine } from '../rules/RulesEngine.js';
import { DebugManager } from '../debug/DebugManager.js';
import { BaseOverlayUpdater } from '../renderer/BaseOverlayUpdater.js';
import { TemplateEntityExtractor } from '../templates/TemplateEntityExtractor.js';

import { StylePresetManager } from '../presets/StylePresetManager.js';
import { ApexChartsOverlayRenderer } from '../renderer/ApexChartsOverlayRenderer.js';

// ✅ ADDED: Import theme system initialization
import { initializeThemeSystem } from '../themes/initializeThemeSystem.js';

// ✅ ADDED: Import overlay renderers for incremental update capabilities
import { StatusGridRenderer } from '../renderer/StatusGridRenderer.js';
import { ButtonOverlay } from '../overlays/ButtonOverlay.js';
import { TextOverlay } from '../overlays/TextOverlay.js';

// ✨ ADDED: Import animation system components
import { AnimationManager } from '../animation/AnimationManager.js';
import { processAnimationConfig } from '../animation/AnimationConfigProcessor.js';

export class SystemsManager {
  constructor() {
    // Initialize core managers
    this.themeManager = new ThemeManager();

    this.stylePresetManager = new StylePresetManager();

    this.dataSourceManager = null;
    this.renderer = null;
    this.debugRenderer = null;
    this.controlsRenderer = null;
    this.hudManager = null;
    this.router = null;
    this.animRegistry = null;
    this.animationManager = null; // ✨ NEW: Phase 5 - Animation system
    this.rulesEngine = null;
    this.debugManager = new DebugManager();
    this.overlayUpdater = null; // ADDED: Unified overlay update system
    this._renderTimeout = null;
    this._reRenderCallback = null;
    this._queuedReRender = false; // ADDED: Flag for queued renders
    this._debugControlsRendering = false;
    this.mergedConfig = null; // Store for entity change handler

    // PHASE 1: Single source of truth for HASS (old properties removed in Step 3C)
    this._hass = null;

    // Keep _previousRuleStates for threshold crossing detection
    this._previousRuleStates = new Map();

    this.styleResolver = null;

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
          cblcarsLog.debug('[SystemsManager] 🔄 Executing queued re-render (render completed)');
          this._queuedReRender = false;

          setTimeout(() => {
            if (!this._internalRenderInProgress && this._reRenderCallback) {
              cblcarsLog.debug('[SystemsManager] 🚀 Executing queued re-render callback');
              try {
                this._reRenderCallback();
              } catch (error) {
                cblcarsLog.error('[SystemsManager] ❌ Queued re-render failed:', error);
              }
            }
          }, 50);
        }
      }
    });

    // ============================================================================
    // OVERLAY RENDERER REGISTRY (Phase 1: Incremental Updates)
    // ============================================================================
    // Maps overlay type → renderer class with incremental update capability
    this._overlayRenderers = new Map([
      ['statusgrid', StatusGridRenderer],
      ['status_grid', StatusGridRenderer],
      ['apexchart', ApexChartsOverlayRenderer], // ✅ Phase 2: COMPLETE
      ['button', ButtonOverlay], // ✅ Phase 3: COMPLETE
      // ['text', TextOverlay], // ❌ REMOVED: Too complex due to bbox recalculation needs
      // Add more renderers as they gain incremental update support:
      // ['line', LineOverlayRenderer], // Phase 5: Future
    ]);
  }

  /**
   * ENHANCED: Initialize systems with pack defaults loading FIRST
   * This ensures defaults are available before any overlay processing
   */
  async initializeSystemsWithPacksFirst(mergedConfig, mountEl, hass) {
    cblcarsLog.debug('[SystemsManager] 🚀 Enhanced initialization: packs and defaults first');

    // Store config and HASS context immediately
    this.mergedConfig = mergedConfig;
    this._hass = hass; // PHASE 1: Use single source

    // PHASE 1: Initialize theme system FIRST (provides all component defaults)
    cblcarsLog.debug('[SystemsManager] 🎨 Phase 1: Initializing theme system');


    let packs;

    // Load pack defaults from merged config provenance
    if (mergedConfig && mergedConfig.__provenance && mergedConfig.__provenance.merge_order) {
      const packLayers = mergedConfig.__provenance.merge_order.filter(layer => layer.type === 'builtin');
      if (packLayers.length > 0) {
        cblcarsLog.debug('[SystemsManager] 📦 Loading packs from merged config provenance');

        const { loadBuiltinPacks } = await import('../packs/loadBuiltinPacks.js');
        const packNames = packLayers.map(layer => layer.pack);

        // Ensure 'core' and 'builtin_themes' packs are always loaded
        if (!packNames.includes('core')) {
          packNames.unshift('core');
        }
        if (!packNames.includes('builtin_themes')) {
          packNames.push('builtin_themes');
        }

        try {
          const packLoadPromise = Promise.resolve(loadBuiltinPacks(packNames));
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Pack loading timeout')), 10000)
          );
          packs = await Promise.race([packLoadPromise, timeoutPromise]);

          if (!packs || !Array.isArray(packs)) {
            throw new Error('Invalid pack loading result');
          }
        } catch (error) {
          cblcarsLog.error('[SystemsManager] ❌ Pack loading failed:', error);
          throw new Error(`Pack loading failed: ${error.message}`);
        }
      }
    } else {
      // Fallback: Load core and builtin_themes packs
      cblcarsLog.debug('[SystemsManager] 📦 No pack provenance, loading core + builtin_themes');
      try {
        const { loadBuiltinPacks } = await import('../packs/loadBuiltinPacks.js');
        packs = loadBuiltinPacks(['core', 'builtin_themes']);
        cblcarsLog.debug('[SystemsManager] ✅ Loaded fallback packs');
      } catch (error) {
        cblcarsLog.error('[SystemsManager] ❌ Fallback pack loading failed:', error);
        throw new Error(`Pack loading failed: ${error.message}`);
      }
    }

    // Initialize theme system with loaded packs
    const requestedTheme = mergedConfig?.theme || 'lcars-classic';
    await this.themeManager.initialize(packs, requestedTheme, mountEl);
    const activeTheme = this.themeManager.getActiveTheme();

    // ✅ ENHANCED: Log theme provenance
    cblcarsLog.info('[SystemsManager] 🎨 Theme system initialized:', {
      requested: requestedTheme,
      active: activeTheme?.name,
      activeId: activeTheme?.id,
      themeCount: this.themeManager.listThemes().length,
      provenance: mergedConfig.__provenance?.theme  // ← Log theme provenance
    });

    // Store in global namespace for access by overlays
    if (typeof window !== 'undefined') {
      window.cblcars = window.cblcars || {};
      window.cblcars.theme = this.themeManager;
      window.cblcars.debug.msd.themeProvenance = mergedConfig.__provenance?.theme;
      cblcarsLog.debug('[SystemsManager] 🔧 ThemeManager globally accessible via window.cblcars.theme');
    }

    // Acquire StyleResolverService reference
    if (typeof window !== 'undefined' && window.cblcars?.styleResolver) {
      this.styleResolver = window.cblcars.styleResolver;
      cblcarsLog.debug('[SystemsManager] ✅ StyleResolverService reference acquired');
    } else {
      cblcarsLog.warn('[SystemsManager] ⚠️ StyleResolverService not found - renderers will use fallback');
    }

    // PHASE 2: Initialize other critical systems that overlays might need
    cblcarsLog.debug('[SystemsManager] ⚙️ Phase 2: Initializing critical systems');

    // Initialize debug manager early with config
    const debugConfig = mergedConfig.debug || {};
    this.debugManager.init(debugConfig);
    cblcarsLog.debug('[SystemsManager] DebugManager initialized with config:', debugConfig);

    // Initialize data source manager FIRST (overlays may reference it)
    await this._initializeDataSources(hass, mergedConfig);

    // CRITICAL FIX: Initialize StylePresetManager with loaded packs
    cblcarsLog.debug('[SystemsManager] 🎨 CRITICAL: Initializing StylePresetManager');
    cblcarsLog.debug('[SystemsManager] Available packs:', packs.map(p => ({ id: p.id, hasStylePresets: !!p.style_presets })));

    if (this.stylePresetManager && !this.stylePresetManager.initialized) {
      await this.stylePresetManager.initialize(packs);
      cblcarsLog.debug('[SystemsManager] ✅ StylePresetManager initialized');
    }

    cblcarsLog.debug('[SystemsManager] ✅ Critical systems ready for overlay processing');
  }

  /**
   * Complete systems initialization after card model is built
   * This is the second phase that happens after overlays can safely be processed
   */
  async completeSystems(mergedConfig, cardModel, mountEl, hass) {
    cblcarsLog.debug('[SystemsManager] 🔧 Completing systems initialization');

    // Initialize rules engine AFTER DataSourceManager with proper connection
    this.rulesEngine = new RulesEngine(mergedConfig.rules, this.dataSourceManager);

    // ADDED: Give RulesEngine access to SystemsManager for HASS state lookup
    this.rulesEngine.systemsManager = this;

    this.rulesEngine.markAllDirty();
    this._instrumentRulesEngine(mergedConfig);

    // NEW: Set up rules engine HASS monitoring
    if (hass) {
      await this.rulesEngine.setupHassMonitoring(hass);

      // Connect re-evaluation to render pipeline
      // When rules are marked dirty (entity changes), evaluate and apply patches
      this.rulesEngine.setReEvaluationCallback(() => {
        cblcarsLog.debug('[SystemsManager] 🔄 RulesEngine re-evaluation callback triggered');

        if (!this._hass) {
          cblcarsLog.warn('[SystemsManager] Cannot evaluate rules - no HASS available');
          return;
        }

        // Evaluate dirty rules
        const ruleResults = this.rulesEngine.evaluateDirty(this._hass);

        cblcarsLog.debug(`[SystemsManager] 🔍 DIRTY RULES RESULT:`, {
          hasBaseSvgUpdate: !!ruleResults.baseSvgUpdate,
          baseSvgUpdate: ruleResults.baseSvgUpdate,
          patchCount: ruleResults.overlayPatches?.length || 0
        });

        if (ruleResults.overlayPatches && ruleResults.overlayPatches.length > 0) {
          cblcarsLog.debug(`[SystemsManager] 🎨 Rules produced patch(es)`);

          // Apply incremental updates
          const updateResults = this._applyIncrementalUpdates(ruleResults.overlayPatches);

          // Selective re-render for overlays that failed incremental update
          if (updateResults.failedOverlays.length > 0) {
            cblcarsLog.debug(`[SystemsManager] 🔄 Triggering SELECTIVE RE-RENDER for ${updateResults.failedOverlays.length} overlay(s)`);
            this._scheduleSelectiveReRender(updateResults.failedOverlays);
          }
        }

        // ✅ NEW: Apply base_svg filter updates from rules
        if (ruleResults.baseSvgUpdate) {
          cblcarsLog.debug(`[SystemsManager] � Rules produced base_svg update`);
          this._applyBaseSvgUpdate(ruleResults.baseSvgUpdate);
        }
      });

      cblcarsLog.debug('[SystemsManager] Rules Engine HASS monitoring configured');
    }

    // Initialize rendering systems
    this.router = new RouterCore(mergedConfig.routing, cardModel.anchors, cardModel.viewBox);
    this.renderer = new AdvancedRenderer(mountEl, this.router, this); // Pass 'this' as systemsManager
    this.debugRenderer = new MsdDebugRenderer();
    this.controlsRenderer = new MsdControlsRenderer(this.renderer);

    // ADDED: Set HASS context on controls renderer immediately if available
    if (this._hass && this.controlsRenderer) {
      cblcarsLog.debug('[SystemsManager] Setting initial HASS context on controls renderer');
      this.controlsRenderer.setHass(this._hass);
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
    cblcarsLog.debug('[SystemsManager] RouterCore marked ready for debug system');

    // Initialize animation registry
    this.animRegistry = new AnimationRegistry();

    // ADDED: Initialize unified overlay update system
    this.overlayUpdater = new BaseOverlayUpdater(this);
    cblcarsLog.debug('[SystemsManager] BaseOverlayUpdater initialized for unified overlay updates');

    // ✨ NEW: Phase 5 - Initialize AnimationManager
    cblcarsLog.debug('[SystemsManager] 🎬 Phase 5: Initializing AnimationManager');
    this.animationManager = new AnimationManager(this);

    // Process animation configuration from merged config
    const animationConfig = processAnimationConfig(mergedConfig);

    // Initialize with processed configuration
    await this.animationManager.initialize(mergedConfig.overlays || [], {
      customPresets: animationConfig.customPresets,
      timelines: animationConfig.timelines
    });

    cblcarsLog.debug('[SystemsManager] ✅ AnimationManager initialized');

    cblcarsLog.debug('[SystemsManager] ✅ All systems initialization complete', {
      hasThemeManager: !!this.themeManager,
      hasStyleResolver: !!this.styleResolver,  // ✅ NEW: Phase 6
      hasDataSourceManager: !!this.dataSourceManager,
      hasRouter: !!this.router,
      hasRenderer: !!this.renderer,
      hasRulesEngine: !!this.rulesEngine,
      hasAnimRegistry: !!this.animRegistry,
      hasAnimationManager: !!this.animationManager,  // ✨ NEW
      hasDebugManager: !!this.debugManager,
      hasControlsRenderer: !!this.controlsRenderer,
      hasDebugRenderer: !!this.debugRenderer
    });
  }

  // Keep the original initializeSystems method for backward compatibility but mark it deprecated
  async initializeSystems(mergedConfig, cardModel, mountEl, hass) {
    cblcarsLog.warn('[SystemsManager] ⚠️ initializeSystems is deprecated, use initializeSystemsWithPacksFirst + completeSystems');

    // Use the new sequenced approach
    await this.initializeSystemsWithPacksFirst(mergedConfig, mountEl, hass);
    await this.completeSystems(mergedConfig, cardModel, mountEl);
  }

  setReRenderCallback(callback) {
    this._reRenderCallback = callback;
  }



  // ============================================================================
  // REMOVED METHOD: _createEntityChangeHandler() - 293 lines removed
  // ============================================================================
  // This complex handler was removed in Phase 1 Step 3B of the architecture refactor.
  //
  // What it did:
  // - Created a closure that handled entity changes with setTimeout delays (10ms, 25ms)
  // - Manually managed _originalHass and _currentHass state copies
  // - Applied template conversions and rule evaluations with multiple phases
  // - Used setTimeout hacks to sequence operations
  //
  // Replaced by:
  // - ingestHassV2() for full HASS updates
  // - DataSource subscriptions for real-time entity updates (primary path)
  // - RulesEngine.ingestHass() for rule evaluation
  // - BaseOverlayUpdater for unified overlay updates
  //
  // Benefits of new architecture:
  // - Single source of truth (_hass)
  // - No setTimeout delays
  // - Cleaner separation of concerns
  // - Real-time subscriptions remain the primary update mechanism
  // ============================================================================


  // ============================================================================
  // REMOVED METHODS: setOriginalHass(), getCurrentHass(), getOriginalHass()
  // ============================================================================
  // These methods were removed in Phase 1 Step 3B of the architecture refactor.
  //
  // setOriginalHass(hass) - Set original HASS copy
  // getCurrentHass() - Get working HASS copy
  // getOriginalHass() - Get pristine HASS copy
  //
  // Replaced by:
  // - ingestHassV2(hass) - Single entry point for HASS updates
  // - getHassV2() - Single source getter
  //
  // Reason for removal: Multiple HASS copies caused state synchronization issues
  // ============================================================================

  /**
   * Render the MSD display
   */
  render() {
    // Rendering is handled automatically via pipeline
    // This method exists for API compatibility
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
      cblcarsLog.warn('[SystemsManager][rules instrumentation] failed', e);
    }
  }

  async _initializeDataSources(hass, mergedConfig) {
    this.dataSourceManager = null;

    // ENHANCED: Better logging and error handling
    if (!hass) {
      cblcarsLog.warn('[SystemsManager] No HASS provided - DataSourceManager will not be initialized');
      return;
    }

    // PHASE 1: Pre-register entity change listener BEFORE creating data sources
    // This ensures the listener is ready when data source subscriptions are set up
    this._entityChangeListenerRegistered = false;

    // ENHANCED: Create auto-DataSources for template entities before processing configured ones
    const configuredDataSources = mergedConfig.data_sources || {};
    const dataSourcesWithTemplates = await this._createTemplateDataSources(mergedConfig, configuredDataSources);

    cblcarsLog.debug('[SystemsManager] 🔍 Using explicit + auto-template data sources mode');
    cblcarsLog.debug('[SystemsManager] 🔍 Configured data sources:', Object.keys(configuredDataSources));
    cblcarsLog.debug('[SystemsManager] 🔍 Total data sources (including auto-template):', Object.keys(dataSourcesWithTemplates));

    // Controls use direct HASS - no data sources needed
    const controlEntities = this._extractControlEntities(mergedConfig);
    cblcarsLog.debug('[SystemsManager] 🔍 Control entities (using direct HASS):', controlEntities);

    // Use configured + auto-created data sources
    const allDataSources = { ...dataSourcesWithTemplates };

    cblcarsLog.debug('[SystemsManager] 📊 Data source summary:', {
      configured: Object.keys(configuredDataSources).length,
      autoCreated: Object.keys(dataSourcesWithTemplates).length - Object.keys(configuredDataSources).length,
      total: Object.keys(allDataSources).length,
      allDataSourceIds: Object.keys(allDataSources)
    });

    if (Object.keys(allDataSources).length === 0) {
      cblcarsLog.debug('[SystemsManager] No data sources configured or auto-created - DataSourceManager will not be initialized');
      cblcarsLog.debug('[SystemsManager] Note: Control overlays will use direct HASS (no data sources needed)');
      return;
    }

    cblcarsLog.debug('[SystemsManager] Initializing DataSourceManager with', Object.keys(allDataSources).length, 'data sources');

    try {
      this.dataSourceManager = new DataSourceManager(hass);

      // PHASE 1: Register entity change listener BEFORE initializing data sources
      // This ensures subscriptions created during initialization can trigger the listener
      this.dataSourceManager.addEntityChangeListener((changedIds) => {
        // CRITICAL: Sync our HASS with DataSourceManager's updated HASS
        // Real-time entity updates come via DataSource subscriptions, which update
        // DataSourceManager.hass but NOT SystemsManager._hass. We need to sync them!
        if (this.dataSourceManager && this.dataSourceManager.hass) {
          this._hass = this.dataSourceManager.hass;
        }

        // Mark rules dirty for changed entities
        if (this.rulesEngine && changedIds.length > 0) {
          // Map entity IDs to DataSource IDs for rules
          const entitiesToMarkDirty = new Set();

          changedIds.forEach(entityId => {
            entitiesToMarkDirty.add(entityId);

            // Check if this entity corresponds to any DataSources used in rules
            if (this.dataSourceManager) {
              for (const [sourceId, source] of this.dataSourceManager.sources) {
                if (source.cfg && source.cfg.entity === entityId) {
                  entitiesToMarkDirty.add(sourceId);
                  cblcarsLog.debug(`[SystemsManager] Mapped entity "${entityId}" to DataSource "${sourceId}"`);
                }
              }
            }
          });

          const finalEntityList = Array.from(entitiesToMarkDirty);
          this.rulesEngine.markEntitiesDirty(finalEntityList);

          // Evaluate rules to check if patches need to be applied
          const ruleResults = this.rulesEngine.evaluateDirty(this._hass);

          cblcarsLog.debug('[SystemsManager] 🔍 RULE EVALUATION RESULT:', {
            patchCount: ruleResults.overlayPatches?.length || 0,
            patches: ruleResults.overlayPatches?.map(p => ({
              overlayId: p.id,
              cellTarget: p.cell_target || p.cellTarget || null,
              styleKeys: Object.keys(p.style || {})
            }))
          });

          if (ruleResults.overlayPatches && ruleResults.overlayPatches.length > 0) {
            cblcarsLog.debug(`[SystemsManager] 🎨 Rules produced patch(es)`);

            // TRY: Incremental updates first (Phase 1: StatusGrid, Phase 2: ApexCharts, etc.)
            const updateResults = this._applyIncrementalUpdates(ruleResults.overlayPatches);

            // SELECTIVE RE-RENDER: Only re-render overlays that failed incremental update
            if (updateResults.failedOverlays.length > 0) {
              cblcarsLog.debug(`[SystemsManager] 🔄 Triggering SELECTIVE RE-RENDER for ${updateResults.failedOverlays.length} overlay(s)`);
              this._scheduleSelectiveReRender(updateResults.failedOverlays);
            } else {
              cblcarsLog.info('[SystemsManager] ✅ All updates completed INCREMENTALLY - NO full re-render needed');
            }
          } else {
            cblcarsLog.debug('[SystemsManager] ℹ️ No rule patches needed');
          }

          // ✅ NEW: Apply base_svg filter updates from rules
          if (ruleResults.baseSvgUpdate) {
            cblcarsLog.debug(`[SystemsManager] � Rules produced base_svg update`);
            this._applyBaseSvgUpdate(ruleResults.baseSvgUpdate);
          }
        }
      });

      cblcarsLog.debug('[SystemsManager] ✅ Entity change listener configured for rule evaluation (BEFORE data source init)');
      this._entityChangeListenerRegistered = true;

      const sourceCount = await this.dataSourceManager.initializeFromConfig(allDataSources);
      cblcarsLog.debug('[SystemsManager] ✅ DataSourceManager initialized -', sourceCount, 'sources started');

      // ADDED: Verify entities are available
      const entityIds = this.dataSourceManager.listIds();
      cblcarsLog.debug('[SystemsManager] ✅ DataSourceManager entities available:', entityIds);

    } catch (error) {
      cblcarsLog.error('[SystemsManager] ❌ DataSourceManager initialization failed:', error);
      cblcarsLog.error('[SystemsManager] Error details:', error.stack);
      this.dataSourceManager = null;
    }
  }

  /**
   * Create auto-DataSources for entities referenced in templates
   * @param {Object} mergedConfig - The merged MSD configuration
   * @param {Object} configuredDataSources - Already configured DataSources
   * @returns {Object} Configuration with auto-created DataSources added
   * @private
   */
  async _createTemplateDataSources(mergedConfig, configuredDataSources) {
    const templateEntities = new Set();

    // Extract template entities from all overlays
    if (mergedConfig.overlays) {
      mergedConfig.overlays.forEach(overlay => {
        try {
          const entities = TemplateEntityExtractor.extractFromOverlay(overlay);
          entities.forEach(entity => templateEntities.add(entity));
        } catch (error) {
          cblcarsLog.error('[SystemsManager] Error extracting entities from overlay:', overlay.id, error);
        }
      });
    }

    // Create auto-DataSources for entities not already configured
    const autoDataSources = {};
    let autoCreatedCount = 0;

    templateEntities.forEach(entityId => {
      // Check if entity already has a configured DataSource
      const hasExistingDataSource = Object.values(configuredDataSources).some(ds =>
        ds.entity === entityId
      );

      if (!hasExistingDataSource) {
        const dataSourceName = `template_${entityId.replace(/\./g, '_')}`;

        // Create lightweight DataSource config for template entity
        autoDataSources[dataSourceName] = {
          entity: entityId,
          windowSeconds: 60,        // Small buffer for template updates
          minEmitMs: 100,          // Responsive updates
          coalesceMs: 50,          // Quick coalescing
          history: { enabled: false }, // No history needed for templates
          _autoCreated: true,      // Mark as auto-created
          _templateEntity: true    // Mark as template entity
        };

        autoCreatedCount++;
      }
    });

    if (autoCreatedCount > 0) {
      cblcarsLog.debug(`[SystemsManager] 📄 Auto-created DataSources for template entities:`,
        Array.from(templateEntities).join(', '));
    }

    // Merge auto-created DataSources with configured ones
    return {
      ...configuredDataSources,
      ...autoDataSources
    };
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


  async destroy() {
    // ADDED: Cleanup ApexCharts instances before destroying other systems
    if (ApexChartsOverlayRenderer) {
      ApexChartsOverlayRenderer.cleanupAll();
      cblcarsLog.debug('[SystemsManager] ApexCharts instances cleaned up');
    }

    // Clean up rules engine first
    if (this.rulesEngine) {
      await this.rulesEngine.destroy();
    }

    // Stop all subscriptions and clean up resources
    this.dataSourceManager?.destroy();
    this.animRegistry?.clear();
    this.debugRenderer?.destroy();
    this.controlsRenderer?.destroy();
    this.renderer?.destroy();
    this.rulesEngine?.destroy();

    if (this.styleResolver) {
      try {
        this.styleResolver.invalidateCache('overlay');
        cblcarsLog.debug('[SystemsManager] StyleResolver overlay cache invalidated');
      } catch (error) {
        cblcarsLog.error('[SystemsManager] StyleResolver cleanup error:', error);
      }
    }

    // Clear timeouts and callbacks
    if (this._renderTimeout) {
      clearTimeout(this._renderTimeout);
      this._renderTimeout = null;
    }
    this._reRenderCallback = null;

    this.styleResolver = null;

    //*** clean up other systems */

    // Remove global references
    if (typeof window !== 'undefined' && window.cblcars.debug.msd) {
      delete window.cblcars.debug.msd.pipelineInstance;
      delete window.cblcars.debug.msd.systemsManager;
    }
  }

  /**
   * Render debug overlays and controls using DebugManager with basic performance tracking
   * @param {Object} resolvedModel - The resolved model
   * @param {Element} mountEl - The shadowRoot/mount element
   */
  async renderDebugAndControls(resolvedModel, mountEl = null) {
    // ADDED: Early exit if already rendering
    if (this._debugControlsRendering) {
      cblcarsLog.debug('[SystemsManager] renderDebugAndControls already in progress, skipping');
      return;
    }

    this._debugControlsRendering = true;

    try {
      const debugState = this.debugManager.getSnapshot();

      cblcarsLog.debug('[SystemsManager] renderDebugAndControls called:', {
        anyEnabled: this.debugManager.isAnyEnabled(),
        controlOverlays: resolvedModel.overlays.filter(o => o.type === 'control').length,
        hasHass: !!this._hass,
        hasResolvedModel: !!resolvedModel,
        hasOverlays: !!resolvedModel?.overlays
      });

      // ADDED: Validate resolved model
      if (!resolvedModel || !resolvedModel.overlays) {
        cblcarsLog.warn('[SystemsManager] Invalid resolved model for renderDebugAndControls');
        return;
      }

      // Render debug visualizations with error boundary
      if (this.debugManager.isAnyEnabled()) {
        try {
          const debugOptions = {
            anchors: resolvedModel.anchors || {},
            overlays: resolvedModel.overlays || [],
            router: this.router,  // ✅ FIXED: Pass router for routing debug visualization
            showAnchors: debugState.anchors,
            showBoundingBoxes: debugState.bounding_boxes,
            showRouting: this.debugManager.canRenderRouting(),
            showPerformance: debugState.performance,
            scale: debugState.scale
          };

          this.debugRenderer.render(mountEl || this.renderer?.mountEl, resolvedModel.viewBox, debugOptions);
          cblcarsLog.debug('[SystemsManager] ✅ Debug renderer completed');
        } catch (error) {
          cblcarsLog.error('[SystemsManager] ❌ Debug renderer failed:', error);
          // Continue execution - don't fail the entire render
        }
      }

      // FIXED: Render control overlays with comprehensive error handling
      const controlOverlays = resolvedModel.overlays.filter(o => o.type === 'control');
      if (controlOverlays.length > 0) {
        cblcarsLog.debug('[SystemsManager] Rendering control overlays:', controlOverlays.map(c => c.id));

        try {
          // ADDED: Validate controls renderer exists
          if (!this.controlsRenderer) {
            cblcarsLog.error('[SystemsManager] No controls renderer available');
            return;
          }

          // Ensure controls renderer has current HASS context
          if (this._hass && this.controlsRenderer) {
            this.controlsRenderer.setHass(this._hass);
            cblcarsLog.debug('[SystemsManager] HASS context applied to controls renderer');
          } else {
            cblcarsLog.warn('[SystemsManager] No HASS context available for controls');
          }

          // REMOVED: Defensive container creation - not needed with SVG foreignObject approach
          // The renderControls() method handles all necessary container creation internally

          // ADDED: Defensive controls rendering with timeout
          const renderPromise = this.controlsRenderer.renderControls(controlOverlays, resolvedModel);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Controls render timeout')), 5000)
          );

          await Promise.race([renderPromise, timeoutPromise]);
          cblcarsLog.debug('[SystemsManager] ✅ Controls rendered successfully');

        } catch (error) {
          cblcarsLog.error('[SystemsManager] ❌ Controls rendering failed:', error);
          cblcarsLog.error('[SystemsManager] Error stack:', error.stack);
        }
      }

    } catch (error) {
      cblcarsLog.error('[SystemsManager] renderDebugAndControls failed completely:', error);
      cblcarsLog.error('[SystemsManager] Error stack:', error.stack);
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
    cblcarsLog.debug('[SystemsManager] ingestHass called with:', {
      hasHass: !!hass,
      hasStates: !!hass?.states,
      entityCount: hass?.states ? Object.keys(hass.states).length : 0,
      hasLightDesk: !!hass?.states?.['light.desk'],
      lightDeskState: hass?.states?.['light.desk']?.state,
      timestamp: new Date().toISOString()
    });

    if (!hass || !hass.states) {
      cblcarsLog.warn('[SystemsManager] ingestHass called without valid hass.states');
      return;
    }

    // PHASE 1: Update single source of truth
    this._hass = hass;

    cblcarsLog.debug('[SystemsManager] Updated _hass with fresh data');

    // ENHANCED: Pass HASS to controls renderer EVERY time to ensure cards get updates
    if (this.controlsRenderer) {
      cblcarsLog.debug('[SystemsManager] Updating HASS context in controls renderer immediately');
      this.controlsRenderer.setHass(hass);
    } else {
      cblcarsLog.warn('[SystemsManager] No controls renderer available for HASS update');
    }

    // DataSources handle HASS updates automatically via their subscriptions
    // No manual ingestion needed - handled by individual data sources
    cblcarsLog.debug('[SystemsManager] HASS ingestion handled by individual data sources');
  }

  updateEntities(map) {
    if (!map || typeof map !== 'object') return;

    cblcarsLog.debug('[SystemsManager] Manual entity updates not supported in DataSources system');
    cblcarsLog.warn('[SystemsManager] Use direct HASS state updates instead of manual entity updates');
  }

  // Entity API methods using DataSourceManager
  listEntities() {
    return this.dataSourceManager ? this.dataSourceManager.listIds() : [];
  }

  getEntity(id) {
    return this.dataSourceManager ? this.dataSourceManager.getEntity(id) : null;
  }

  // ============================================================================
  // REMOVED METHOD: setupDirectHassSubscription() - ~200 lines removed
  // ============================================================================
  // This method was removed in Phase 1 Step 3B of the architecture refactor.
  //
  // What it did:
  // - Set up WebSocket subscription to state_changed events
  // - Manually updated _originalHass and _currentHass on every entity change
  // - Forwarded HASS to controls for control entities
  // - Created duplicate update path alongside DataSource subscriptions
  //
  // Replaced by:
  // - DataSource subscriptions handle real-time entity updates (primary path)
  // - ingestHass() handles full HASS refreshes (initialization, reconnection)
  // - Single source of truth in _hass property
  //
  // Reason for removal: Duplicate update path, manual HASS management, state sync issues
  // ============================================================================

  /**
   * Set up global HUD interface (placeholder for future implementation)
   * @private
   */
  _setupGlobalHudInterface() {
    cblcarsLog.debug('[SystemsManager] Global HUD interface setup completed');
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
      cblcarsLog.debug('[SystemsManager] 🎯 DataSource entities affected by changes:', affectedDataSources);

      // ADVANCED: Check if the specific rule thresholds might be crossed
      // This is where we could add more sophisticated logic to detect actual rule changes
      const mightCrossThresholds = this._checkThresholdCrossing(changedIds);

      cblcarsLog.debug('[SystemsManager] 🌡️ Threshold crossing check:', mightCrossThresholds);
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
            cblcarsLog.debug('[SystemsManager] 🎯 Rule condition potentially affected:', {
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

              cblcarsLog.debug('[SystemsManager] 🌡️ Detailed threshold analysis:', {
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

              cblcarsLog.debug('[SystemsManager] 📊 Rule state comparison:', {
                ruleKey,
                previouslyMatched,
                currentlyMatches,
                stateChanged: previouslyMatched !== currentlyMatches
              });

              // Update the stored state
              this._previousRuleStates.set(ruleKey, currentlyMatches);

              // Only trigger re-render if the rule state actually changed
              if (previouslyMatched !== undefined && previouslyMatched !== currentlyMatches) {
                cblcarsLog.debug('[SystemsManager] 🔄 Rule state CHANGED - threshold crossing detected!');
                return true;
              } else if (previouslyMatched === undefined) {
                cblcarsLog.debug('[SystemsManager] 🆕 First rule evaluation - storing state');
                // First time seeing this rule, don't trigger re-render
                return false;
              } else {
                cblcarsLog.debug('[SystemsManager] 📌 Rule state UNCHANGED - no threshold crossing');
                return false;
              }
            }
          }
        }
      }
    }

    cblcarsLog.debug('[SystemsManager] 📊 No threshold crossings detected');
    return false;
  }

  // ============================================================================
  // INCREMENTAL UPDATE SYSTEM (Phase 1)
  // ============================================================================

  /**
   * Get renderer class for overlay type
   * @private
   * @param {string} type - Overlay type
   * @returns {Class|null} Renderer class or null
   */
  _getRendererForType(type) {
    return this._overlayRenderers.get(type) || null;
  }

  /**
   * Find overlay configuration by ID
   * @private
   * @param {string} overlayId - Overlay ID
   * @returns {Object|null} Overlay config or null
   */
  _findOverlayById(overlayId) {
    const resolvedModel = this.modelBuilder?.getResolvedModel?.();
    if (!resolvedModel?.overlays) return null;

    return resolvedModel.overlays.find(o => o.id === overlayId) || null;
  }

  /**
   * Find overlay element in DOM
   * Uses same search pattern as AdvancedRenderer and StatusGridRenderer
   * @private
   * @param {Object} overlay - Overlay configuration
   * @returns {Element|null} DOM element or null
   */
  _findOverlayElement(overlay) {
    let element = null;

    // Method 1: Search in renderer mount element (primary - shadowRoot or container)
    if (this.renderer?.mountEl) {
      const overlayGroup = this.renderer.mountEl.querySelector('#msd-overlay-container');
      if (overlayGroup) {
        element = overlayGroup.querySelector(`[data-overlay-id="${overlay.id}"]`);
        if (element) {
          cblcarsLog.debug(`[SystemsManager] ✅ Found overlay element in #msd-overlay-container: ${overlay.id}`);
          return element;
        }
      }

      // Fallback: Direct search in mountEl
      element = this.renderer.mountEl.querySelector(`[data-overlay-id="${overlay.id}"]`);
      if (element) {
        cblcarsLog.debug(`[SystemsManager] ✅ Found overlay element in mountEl: ${overlay.id}`);
        return element;
      }
    }

    // Method 2: Card shadow DOM fallback (for compatibility)
    const card = typeof window !== 'undefined' ? window.cb_lcars_card_instance : null;
    if (!element && card?.shadowRoot) {
      element = card.shadowRoot.querySelector(`[data-overlay-id="${overlay.id}"]`);
      if (element) {
        cblcarsLog.debug(`[SystemsManager] ✅ Found overlay element in card shadowRoot: ${overlay.id}`);
        return element;
      }
    }

    // Method 3: Document search (last resort)
    if (!element && typeof document !== 'undefined') {
      element = document.querySelector(`[data-overlay-id="${overlay.id}"]`);
      if (element) {
        cblcarsLog.debug(`[SystemsManager] ✅ Found overlay element in document: ${overlay.id}`);
        return element;
      }
    }

    cblcarsLog.warn(`[SystemsManager] ❌ Could not find overlay element: ${overlay.id}`, {
      hasMountEl: !!this.renderer?.mountEl,
      hasOverlayContainer: !!this.renderer?.mountEl?.querySelector('#msd-overlay-container'),
      hasCardShadowRoot: !!(typeof window !== 'undefined' && window.cb_lcars_card_instance?.shadowRoot)
    });

    return null;
  }

  /**
   * Apply incremental updates to overlays when rules produce patches
   * Falls back to full re-render if incremental not supported/available
   * @private
   * @param {Array} overlayPatches - Rule patches from rulesEngine.evaluateDirty()
   * @returns {Object} Results with successfulOverlays and failedOverlays arrays
   */
  _applyIncrementalUpdates(overlayPatches) {
    cblcarsLog.debug(`[SystemsManager] 🎨 ATTEMPTING INCREMENTAL UPDATES for ${overlayPatches.length} overlay(s)`);

    const failedOverlays = [];
    const successfulOverlays = [];

    overlayPatches.forEach(patch => {
      // Find overlay config
      const overlay = this._findOverlayById(patch.id);
      if (!overlay) {
        cblcarsLog.warn(`[SystemsManager] ⚠️ Overlay not found: ${patch.id}`);
        failedOverlays.push({ id: patch.id, reason: 'Overlay config not found', patch });
        return;
      }

      // CRITICAL FIX: Merge patch style into finalStyle for incremental updates
      // The overlay from resolvedModel has the OLD finalStyle from initial page load
      // We need to apply the NEW patch to get the current style
      if (patch.style && Object.keys(patch.style).length > 0) {
        cblcarsLog.debug(`[SystemsManager] 🎨 Merging patch style into finalStyle for ${patch.id}:`, {
          oldColor: overlay.finalStyle?.color,
          patchColor: patch.style.color,
          patchKeys: Object.keys(patch.style)
        });

        // Merge patch style into finalStyle
        overlay.finalStyle = {
          ...(overlay.finalStyle || overlay.style || {}),
          ...patch.style
        };

        cblcarsLog.debug(`[SystemsManager] ✅ Merged finalStyle for ${patch.id}:`, {
          newColor: overlay.finalStyle.color,
          finalStyleKeys: Object.keys(overlay.finalStyle)
        });
      }

      // ✨ NEW: Process animations from rule patches (Phase 2)
      if (patch.animations && Array.isArray(patch.animations) && patch.animations.length > 0) {
        cblcarsLog.debug(`[SystemsManager] 🎬 Triggering ${patch.animations.length} animation(s) for ${patch.id} from rule`);

        if (this.animationManager) {
          patch.animations.forEach(animDef => {
            this.animationManager.playAnimation(patch.id, animDef);
          });
        } else {
          cblcarsLog.warn(`[SystemsManager] AnimationManager not available - cannot trigger animations for ${patch.id}`);
        }
      }

      // Get renderer for this overlay type
      const RendererClass = this._getRendererForType(overlay.type);
      if (!RendererClass) {
        // Control overlays (embedded HA cards) don't have renderers - this is expected
        const isControl = overlay.type === 'control';
        if (isControl) {
          cblcarsLog.debug(`[SystemsManager] Control overlay "${overlay.id}" has no renderer - will use SELECTIVE RE-RENDER`);
        } else {
          cblcarsLog.debug(`[SystemsManager] No renderer registered for type "${overlay.type}" - will use SELECTIVE RE-RENDER: ${overlay.id}`);
        }
        failedOverlays.push({ id: overlay.id, type: overlay.type, reason: 'No renderer registered', overlay, patch });
        return;
      }

      // Check if renderer supports incremental updates
      if (!RendererClass.supportsIncrementalUpdate || !RendererClass.supportsIncrementalUpdate()) {
        // Normal behavior - many renderers don't support incremental updates yet
        cblcarsLog.debug(`[SystemsManager] Renderer for "${overlay.type}" does not support incremental updates - will use SELECTIVE RE-RENDER: ${overlay.id}`);
        failedOverlays.push({ id: overlay.id, type: overlay.type, reason: 'Incremental not supported by renderer', overlay, patch });
        return;
      }

      // Find existing overlay DOM element
      const overlayElement = this._findOverlayElement(overlay);
      if (!overlayElement) {
        // Could happen during initialization or if overlay was removed
        cblcarsLog.debug(`[SystemsManager] Overlay element not found in DOM - will use SELECTIVE RE-RENDER: ${overlay.id}`);
        failedOverlays.push({ id: overlay.id, type: overlay.type, reason: 'DOM element not found', overlay, patch });
        return;
      }

      // Attempt incremental update
      try {
        const context = {
          dataSourceManager: this.dataSourceManager,
          systemsManager: this,
          hass: this._hass,
          patch: patch  // Pass the full patch object including cellTarget
        };

        const succeeded = RendererClass.updateIncremental(overlay, overlayElement, context);

        if (!succeeded) {
          // Incremental update declined - will fall back to full re-render (expected for some changes)
          cblcarsLog.debug(`[SystemsManager] Incremental update returned false - will use SELECTIVE RE-RENDER: ${overlay.id}`);
          failedOverlays.push({ id: overlay.id, type: overlay.type, reason: 'Update method returned false', overlay, patch });
        } else {
          cblcarsLog.debug(`[SystemsManager] ✅ INCREMENTAL UPDATE SUCCESS: ${overlay.type} "${overlay.id}"`);
          successfulOverlays.push({ id: overlay.id, type: overlay.type });
        }
      } catch (error) {
        cblcarsLog.error(`[SystemsManager] ❌ Incremental update ERROR: ${overlay.id}`, error);
        failedOverlays.push({ id: overlay.id, type: overlay.type, reason: `Exception: ${error.message}`, overlay, patch });
      }
    });

    // Log detailed summary
    const allSucceeded = failedOverlays.length === 0;

    if (allSucceeded) {
      cblcarsLog.info(`[SystemsManager] ✅ ALL ${overlayPatches.length} overlay(s) updated INCREMENTALLY - NO re-render needed`);
      successfulOverlays.forEach(o => {
        cblcarsLog.debug(`  ✅ ${o.type}: ${o.id}`);
      });
    } else {
      const successCount = successfulOverlays.length;
      const failCount = failedOverlays.length;

      // Selective re-render is normal behavior, not a warning
      cblcarsLog.debug(`[SystemsManager] ${failCount}/${overlayPatches.length} overlay(s) need SELECTIVE RE-RENDER`);

      if (successCount > 0) {
        cblcarsLog.debug(`[SystemsManager] ✅ Successfully updated incrementally (${successCount}):`);
        successfulOverlays.forEach(o => {
          cblcarsLog.debug(`  ✅ ${o.type}: ${o.id}`);
        });
      }

      cblcarsLog.debug(`[SystemsManager] Will selectively re-render (${failCount}):`);
      failedOverlays.forEach(f => {
        cblcarsLog.debug(`  ❌ ${f.type || 'unknown'}: ${f.id} - ${f.reason}`);
      });
    }

    return { successfulOverlays, failedOverlays, allSucceeded };
  }

  /**
   * Apply base_svg filter update from rule
   * @param {Object} baseSvgConfig - base_svg configuration from rule.apply.base_svg
   * @private
   */
  async _applyBaseSvgUpdate(baseSvgConfig) {
    if (!baseSvgConfig) return;

    try {
      // Find the base SVG content group (not the root SVG element)
      const mountEl = this.renderer?.mountEl;

      cblcarsLog.debug('[SystemsManager] 🔍 Searching for base content group:', {
        hasMountEl: !!mountEl,
        mountElTag: mountEl?.tagName,
        svgExists: !!mountEl?.querySelector('svg'),
        allSvgGroups: Array.from(mountEl?.querySelectorAll('svg g') || []).map(g => g.id).filter(id => id)
      });

      const baseSvgElement = mountEl?.querySelector('#__msd-base-content');

      if (!baseSvgElement) {
        cblcarsLog.warn('[SystemsManager] Cannot update base SVG filters - base content group not found');
        cblcarsLog.debug('[SystemsManager] Available groups in SVG:',
          Array.from(mountEl?.querySelectorAll('svg g') || []).map(g => ({
            id: g.id,
            tagName: g.tagName
          }))
        );
        return;
      }

      cblcarsLog.debug('[SystemsManager] ✅ Found base content group:', {
        id: baseSvgElement.id,
        tagName: baseSvgElement.tagName
      });

      // Resolve filters (preset or explicit)
      let filters = null;

      if (baseSvgConfig.filter_preset) {
        const preset = this.themeManager?.getFilterPreset(baseSvgConfig.filter_preset);
        if (preset) {
          filters = { ...preset };
          cblcarsLog.debug(`[SystemsManager] Resolved filter preset '${baseSvgConfig.filter_preset}':`, filters);
        } else {
          cblcarsLog.warn(`[SystemsManager] Unknown filter preset: ${baseSvgConfig.filter_preset}`);
          return;
        }
      }

      // Merge explicit filters (they override preset values)
      if (baseSvgConfig.filters) {
        filters = filters ? { ...filters, ...baseSvgConfig.filters } : { ...baseSvgConfig.filters };
      }

      // Check if this is a clear/remove operation (preset: "none" or empty filters object)
      const isClearOperation = baseSvgConfig.filter_preset === 'none' ||
                               (filters && Object.keys(filters).length === 0);

      const transition = baseSvgConfig.transition || 1000; // Default 1s transition

      if (isClearOperation || !filters) {
        // Clear filters (remove all filtering)
        const { clearBaseSvgFilters } = await import('../utils/BaseSvgFilters.js');
        clearBaseSvgFilters(baseSvgElement, transition);
        cblcarsLog.debug(`[SystemsManager] ✅ Cleared base SVG filters`);
        return;
      }

      // Apply the filters with transition
      const { transitionBaseSvgFilters } = await import('../utils/BaseSvgFilters.js');
      await transitionBaseSvgFilters(baseSvgElement, filters, transition);

      cblcarsLog.debug(`[SystemsManager] ✅ Applied base SVG filters:`, filters);
    } catch (error) {
      cblcarsLog.error('[SystemsManager] Failed to apply base SVG filter update:', error);
    }
  }

  /**
   * Schedule a full re-render with proper queuing
   * @private
   */
  _scheduleFullReRender() {
    cblcarsLog.info('[SystemsManager] 📅 SCHEDULED full re-render (100ms delay)');

    if (this._renderTimeout) {
      cblcarsLog.debug('[SystemsManager] ⏰ Clearing existing render timeout');
      clearTimeout(this._renderTimeout);
    }

    // Safe re-render for data source changes
    this._renderTimeout = setTimeout(() => {
      if (this._reRenderCallback && !this._renderInProgress) {
        try {
          this._renderInProgress = true;
          cblcarsLog.info('[SystemsManager] 🚀 EXECUTING full re-render from rule change timeout');
          this._reRenderCallback();
        } catch (error) {
          cblcarsLog.error('[SystemsManager] ❌ Re-render FAILED in entity change handler:', error);
        } finally {
          this._renderInProgress = false;
        }
      } else {
        cblcarsLog.warn('[SystemsManager] ⚠️ Re-render NOT triggered:', {
          hasCallback: !!this._reRenderCallback,
          renderInProgress: this._renderInProgress
        });
      }
      this._renderTimeout = null;
    }, 100);
  }

  /**
   * Schedule a selective re-render for only specific overlays that failed incremental update
   * @private
   * @param {Array} failedOverlays - Array of overlay info objects with {id, type, overlay, patch}
   */
  _scheduleSelectiveReRender(failedOverlays) {
    cblcarsLog.debug(`[SystemsManager] 📅 SCHEDULED selective re-render for ${failedOverlays.length} overlay(s) (100ms delay)`);

    if (this._selectiveRenderTimeout) {
      cblcarsLog.debug('[SystemsManager] ⏰ Clearing existing selective render timeout');
      clearTimeout(this._selectiveRenderTimeout);
    }

    // Store failed overlays for the selective render
    this._overlaysToReRender = failedOverlays;

    this._selectiveRenderTimeout = setTimeout(() => {
      cblcarsLog.debug(`[SystemsManager] 🚀 EXECUTING selective re-render for ${failedOverlays.length} overlay(s)`);

      failedOverlays.forEach(failedInfo => {
        try {
          const { overlay, patch } = failedInfo;

          // Apply the patch to the overlay config (since it failed incremental update)
          // This ensures the overlay has the correct styles when re-rendered
          if (patch && overlay) {
            cblcarsLog.debug(`[SystemsManager] 🎨 Applying patch to overlay before selective re-render: ${overlay.id}`);

            // The patch has already been applied by ModelBuilder during rule evaluation
            // We just need to trigger a re-render of this specific overlay
            // For now, we'll use the full re-render as a fallback since we need
            // the renderer to re-render just this one overlay

            // TODO: Implement per-overlay re-render capability in AdvancedRenderer
            // For now, log and continue - the full re-render will handle it
            cblcarsLog.debug(`[SystemsManager] ℹ️ Overlay ${overlay.id} will be re-rendered in next full render`);
          }
        } catch (error) {
          cblcarsLog.error(`[SystemsManager] ❌ Error in selective re-render for ${failedInfo.id}:`, error);
        }
      });

      // For now, trigger a full re-render if ANY overlay failed
      // TODO: Implement true selective re-rendering at the renderer level
      cblcarsLog.debug('[SystemsManager] 🔄 Using AdvancedRenderer.reRenderOverlays() for selective re-rendering');

      // Get the complete resolved model (needed for anchors, viewBox, etc.)
      const resolvedModel = this.modelBuilder?.getResolvedModel();

      if (!resolvedModel || !this.renderer) {
        cblcarsLog.warn('[SystemsManager] ⚠️ Cannot selective re-render - missing model or renderer');
        cblcarsLog.info('[SystemsManager] 🔄 Falling back to FULL re-render');
        this._scheduleFullReRender();
      } else {
        // ✅ CRITICAL FIX: Get fresh overlays from resolvedModel (which has patches applied)
        // not from failedOverlays (which has stale objects from before patches)
        const overlayIdsToReRender = failedOverlays.map(f => f.overlay?.id).filter(id => id);
        const overlaysToReRender = resolvedModel.overlays.filter(o => overlayIdsToReRender.includes(o.id));

        if (overlaysToReRender.length === 0) {
          cblcarsLog.warn('[SystemsManager] ⚠️ No valid overlays to re-render');
          return;
        }

        const success = this.renderer.reRenderOverlays(overlaysToReRender, resolvedModel);

        if (success) {
          cblcarsLog.info('[SystemsManager] ✅ SELECTIVE RE-RENDER COMPLETE');

          // ✅ NEW: Re-render debug visualizations after selective re-render
          if (this.debugManager.isAnyEnabled()) {
            cblcarsLog.debug('[SystemsManager] 🔍 Updating debug visualizations after selective re-render');
            this.renderDebugAndControls(resolvedModel);
          }
        } else {
          cblcarsLog.warn('[SystemsManager] ⚠️ Selective re-render failed - falling back to FULL re-render');
          this._scheduleFullReRender();
        }
      }

      this._selectiveRenderTimeout = null;
      this._overlaysToReRender = null;
    }, 100);
  }

  /**
   * Update text overlays when DataSource entities change
   * @param {Array} changedIds - Entity IDs that changed
   * @private
   */

  // REMOVED METHOD: _updateTextOverlaysForDataSourceChanges
  // This method was deprecated and replaced by the unified BaseOverlayUpdater system.
  // Deleted in Phase 0 of architecture refactor.

  // REMOVED METHOD: _findDataSourceForEntity
  // This was only used by _updateTextOverlaysForDataSourceChanges.
  // Deleted in Phase 0 of architecture refactor.

  // ============================================================================
  // PHASE 1: HASS Management Methods (Completed - Phase 3D renamed V2 methods)
  // ============================================================================

  /**
   * Ingest fresh HASS and propagate to all systems in correct order
   * Single source of truth for HASS (renamed from ingestHassV2 in Phase 3D)
   * @param {Object} hass - Home Assistant state object
   */
  ingestHass(hass) {
    if (!hass || !hass.states) {
      cblcarsLog.warn('[SystemsManager] ingestHass: Invalid HASS provided');
      return;
    }

    cblcarsLog.debug('[SystemsManager] 📥 ingestHass: Ingesting fresh HASS:', {
      entityCount: Object.keys(hass.states).length,
      timestamp: new Date().toISOString()
    });

    // Store in single source of truth
    this._hass = hass;

    // Propagate to subsystems in correct order
    this._propagateHassToSystems(hass);
  }

  /**
   * Propagate HASS to subsystems in correct order
   * ORDER MATTERS: DataSourceManager → RulesEngine → Controls
   * (renamed from _propagateHassToSystemsV2 in Phase 3D)
   * @private
   */
  _propagateHassToSystems(hass) {
    cblcarsLog.debug('[SystemsManager] 🔄 _propagateHassToSystems: Starting ordered propagation');

    // 1. DataSourceManager first (provides entity values)
    if (this.dataSourceManager && typeof this.dataSourceManager.ingestHass === 'function') {
      cblcarsLog.debug('[SystemsManager] 📊 Propagating to DataSourceManager');
      this.dataSourceManager.ingestHass(hass);
    } else {
      cblcarsLog.debug('[SystemsManager] ⏭️ DataSourceManager not ready or no ingestHass method');
    }

    // 2. RulesEngine second (evaluates conditions with fresh data)
    if (this.rulesEngine && typeof this.rulesEngine.ingestHass === 'function') {
      cblcarsLog.debug('[SystemsManager] 📏 Propagating to RulesEngine', {
        hasRulesEngine: !!this.rulesEngine,
        hasMethod: typeof this.rulesEngine.ingestHass === 'function'
      });
      this.rulesEngine.ingestHass(hass);
      cblcarsLog.info('[SystemsManager] ✅ RulesEngine.ingestHass() completed');
    } else {
      cblcarsLog.warn('[SystemsManager] ⚠️ RulesEngine not ready or no ingestHass method', {
        hasRulesEngine: !!this.rulesEngine,
        hasMethod: this.rulesEngine ? typeof this.rulesEngine.ingestHass : 'no rulesEngine'
      });
    }

    // 3. Controls third (direct HASS access)
    if (this.controlsRenderer) {
      cblcarsLog.debug('[SystemsManager] 🎮 Propagating to Controls');
      this.controlsRenderer.setHass(hass);
    } else {
      cblcarsLog.debug('[SystemsManager] ⏭️ Controls not ready');
    }

    // 4. Overlays update automatically via DataSource subscriptions
    cblcarsLog.debug('[SystemsManager] ✅ _propagateHassToSystems: Propagation complete');
  }

  /**
   * Get current HASS (single source of truth)
   * (renamed from getHassV2 in Phase 3D)
   * @returns {Object} Current Home Assistant state
   */
  getHass() {
    return this._hass;
  }

  /**
   * Get the resolved model from ModelBuilder
   * @returns {Object} Resolved model with overlays
   */
  getResolvedModel() {
    return this.modelBuilder?.getResolvedModel();
  }
}

// CLEANUP NOTE: The old text-specific overlay update methods have been removed
  // and replaced with the unified BaseOverlayUpdater system in BaseOverlayUpdater.js
  // This provides consistent template processing across all overlay types.
// CLEANUP NOTE: The old text-specific overlay update methods have been removed
  // and replaced with the unified BaseOverlayUpdater system in BaseOverlayUpdater.js
  // This provides consistent template processing across all overlay types.

