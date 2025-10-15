// Add these new methods to SystemsManager class:

/**
 * ENHANCED: Initialize systems with pack defaults loading FIRST
 * This ensures defaults are available before any overlay processing
 */
async initializeSystemsWithPacksFirst(mergedConfig, mountEl, hass) {
  cblcarsLog.debug('[SystemsManager] 🚀 Enhanced initialization: packs and defaults first');

  // Store config and HASS context immediately
  this.mergedConfig = mergedConfig;
  this._currentHass = hass;

  // PHASE 1: Initialize defaults manager and load pack defaults FIRST
  cblcarsLog.debug('[SystemsManager] 📦 Phase 1: Loading pack defaults');
  this.defaultsManager = new MsdDefaultsManager();

  // Load pack defaults from merged config provenance
  if (mergedConfig && mergedConfig.__provenance && mergedConfig.__provenance.merge_order) {
    const packLayers = mergedConfig.__provenance.merge_order.filter(layer => layer.type === 'builtin');
    if (packLayers.length > 0) {
      cblcarsLog.debug('[SystemsManager] 📦 Loading pack defaults from merged config provenance');

      // Import pack loading function and load the packs used in merge
      const { loadBuiltinPacks } = await import('../packs/loadBuiltinPacks.js');
      const packNames = packLayers.map(layer => layer.pack);

      // Ensure 'core' pack is always loaded for builtin defaults
      if (!packNames.includes('core')) {
        packNames.unshift('core');
        cblcarsLog.debug('[SystemsManager] 📦 Added core pack for builtin defaults');
      }

      const packs = loadBuiltinPacks(packNames);

      this.defaultsManager.loadFromPacks(packs, mergedConfig.active_profile || mergedConfig.active_profiles);
      cblcarsLog.debug('[SystemsManager] ✅ Loaded pack defaults:', packNames, (mergedConfig.active_profile || mergedConfig.active_profiles) ? `(profile: ${JSON.stringify(mergedConfig.active_profile || mergedConfig.active_profiles)})` : '(all profiles)');
    }
  } else {
    // Fallback: Always load core pack for basic defaults if no pack provenance
    cblcarsLog.debug('[SystemsManager] 📦 No pack provenance, loading core pack for basic defaults');
    const { loadBuiltinPacks } = await import('../packs/loadBuiltinPacks.js');
    const corePacks = loadBuiltinPacks(['core']);
    this.defaultsManager.loadFromPacks(corePacks, mergedConfig?.active_profile || mergedConfig?.active_profiles);
    cblcarsLog.debug('[SystemsManager] ✅ Loaded core pack defaults', (mergedConfig?.active_profile || mergedConfig?.active_profiles) ? `(profile: ${JSON.stringify(mergedConfig.active_profile || mergedConfig.active_profiles)})` : '(all profiles)');
  }

  // Store in global CB-LCARS namespace for immediate access
  if (typeof window !== 'undefined') {
    window.cblcars = window.cblcars || {};
    window.cblcars.defaults = this.defaultsManager;
    cblcarsLog.debug('[SystemsManager] 🔧 MSD Defaults Manager initialized and globally accessible');
  }

  // PHASE 2: Initialize other critical systems that overlays might need
  cblcarsLog.debug('[SystemsManager] ⚙️ Phase 2: Initializing critical systems');
  
  // Initialize debug manager early with config
  const debugConfig = mergedConfig.debug || {};
  this.debugManager.init(debugConfig);
  cblcarsLog.debug('[SystemsManager] DebugManager initialized with config:', debugConfig);

  // Initialize data source manager FIRST (overlays may reference it)
  await this._initializeDataSources(hass, mergedConfig);

  cblcarsLog.debug('[SystemsManager] ✅ Critical systems ready for overlay processing');
}

/**
 * Complete systems initialization after card model is built
 * This is the second phase that happens after overlays can safely be processed
 */
async completeSystems(mergedConfig, cardModel) {
  cblcarsLog.debug('[SystemsManager] 🔧 Completing systems initialization');

  // Initialize rules engine AFTER DataSourceManager with proper connection
  this.rulesEngine = new RulesEngine(mergedConfig.rules, this.dataSourceManager);
  this.rulesEngine.markAllDirty();
  this._instrumentRulesEngine(mergedConfig);

  // Initialize router
  const routingConfig = mergedConfig.routing || {};
  this.router = new RoutingEngine(routingConfig);

  // Initialize animation registry
  this.animRegistry = new AnimationRegistry();

  // Initialize renderer subsystems
  this.renderer = new AdvancedRenderer(this, cardModel);
  this.debugRenderer = new MsdDebugRenderer(this.debugManager);
  this.controlsRenderer = new ControlsRenderer(this);

  // Initialize overlay updater
  this.overlayUpdater = new OverlayUpdater(this);

  // Setup HUD manager
  this.hudManager = new MsdHudManager();
  this._setupGlobalHudInterface();

  // Setup entity change handlers and subscriptions
  this._setupGlobalEntityChangeHandlers();

  cblcarsLog.debug('[SystemsManager] ✅ All systems initialization complete');
}

// Keep the original initializeSystems method for backward compatibility but mark it deprecated
async initializeSystems(mergedConfig, cardModel, mountEl, hass) {
  cblcarsLog.warn('[SystemsManager] ⚠️ initializeSystems is deprecated, use initializeSystemsWithPacksFirst + completeSystems');
  
  // Use the new sequenced approach
  await this.initializeSystemsWithPacksFirst(mergedConfig, mountEl, hass);
  await this.completeSystems(mergedConfig, cardModel);
}