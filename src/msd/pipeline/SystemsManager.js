import { AdvancedRenderer } from '../renderer/AdvancedRenderer.js';
import { MsdDebugRenderer } from '../debug/MsdDebugRenderer.js';
import { MsdControlsRenderer } from '../controls/MsdControlsRenderer.js';
import { MsdHudManager } from '../hud/MsdHudManager.js';
// REMOVED: EntityRuntime import - migration complete
import { DataSourceManager } from '../data/DataSourceManager.js';
import { RouterCore } from '../routing/RouterCore.js';
import { AnimationRegistry } from '../animation/AnimationRegistry.js';
import { RulesEngine } from '../rules/RulesEngine.js';

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
    this._renderTimeout = null;
    this._reRenderCallback = null;
    this.mergedConfig = null; // Store for entity change handler
  }

  async initializeSystems(mergedConfig, cardModel, mountEl, hass) {
    console.log('[MSD v1] Initializing runtime systems');

    // Store config for later use
    this.mergedConfig = mergedConfig;

    // Initialize rules engine
    this.rulesEngine = new RulesEngine(mergedConfig.rules);
    this.rulesEngine.markAllDirty();
    this._instrumentRulesEngine(mergedConfig);

    // Initialize data source manager FIRST
    await this._initializeDataSources(hass, mergedConfig);

    // Connect data source manager to rules engine
    if (this.dataSourceManager) {
      this.dataSourceManager.addEntityChangeListener(this._createEntityChangeHandler());
      console.log('[MSD v1] DataSourceManager connected to rules engine');

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
    this.hudManager = new MsdHudManager();

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

      // Check if any changed entities are used by data sources
      let dataSourcesAffected = false;
      if (this.dataSourceManager) {
        const dataSourceEntities = new Set();
        Object.values(this.mergedConfig?.data_sources || {}).forEach(ds => {
          if (ds.entity) dataSourceEntities.add(ds.entity);
        });

        dataSourcesAffected = changedIds.some(id => dataSourceEntities.has(id));

        if (dataSourcesAffected) {
          console.log('[MSD v1] Data source entities changed:', changedIds.filter(id => dataSourceEntities.has(id)));
        }
      }

      // Mark rules dirty for changed entities
      this.rulesEngine.markEntitiesDirty(changedIds);

      // Shorter debounce for data source changes, normal for others
      const debounceMs = dataSourcesAffected ? 250 : 500;

      if (this._renderTimeout) clearTimeout(this._renderTimeout);
      this._renderTimeout = setTimeout(() => {
        if (this._reRenderCallback) {
          this._reRenderCallback();
        }
        this._renderTimeout = null;
      }, debounceMs);
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

    if (!mergedConfig.data_sources || Object.keys(mergedConfig.data_sources).length === 0) {
      console.log('[MSD v1] No data sources configured - DataSourceManager will not be initialized');
      return;
    }

    console.log('[MSD v1] Initializing DataSourceManager with', Object.keys(mergedConfig.data_sources).length, 'sources');

    try {
      this.dataSourceManager = new DataSourceManager(hass);
      const sourceCount = await this.dataSourceManager.initializeFromConfig(mergedConfig.data_sources);
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

  renderDebugAndControls(resolvedModel) {
    // Render debug visualization if flags enabled
    const debugFlags = this._getDebugFlags();
    if (this._shouldRenderDebug(debugFlags)) {
      console.log('[MSD v1] Rendering debug visualization');
      this.debugRenderer.render(resolvedModel, debugFlags);
    }

    // Render controls if any exist
    const controlOverlays = resolvedModel.overlays.filter(o => o.type === 'control');
    if (controlOverlays.length > 0) {
      console.log('[MSD v1] Rendering control overlays:', controlOverlays.length);
      this.controlsRenderer.renderControls(controlOverlays, resolvedModel);
    }
  }

  _getDebugFlags() {
    return window.cblcars?._debugFlags || {};
  }

  _shouldRenderDebug(debugFlags) {
    return debugFlags && (debugFlags.overlay || debugFlags.connectors || debugFlags.geometry);
  }

  // Public API methods - now exclusively using DataSourceManager
  ingestHass(hass) {
    if (!hass || !hass.states) {
      console.warn('[MSD v1] ingestHass called without valid hass.states');
      return;
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
}
