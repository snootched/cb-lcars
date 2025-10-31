I'll analyze the pack loading timing issue and provide a solution to ensure packs are fully loaded before any overlay rendering begins.Looking at the search results and the code structure, I can see the issue clearly. The problem is that overlays are being rendered before the pack merging and defaults loading is complete, resulting in a timing issue where the StatusGridRenderer can't access the proper pack defaults. Let me analyze the pipeline and provide a comprehensive solution.Looking at the search results and your description, I can see the root cause of the timing issue. The problem is that overlay rendering is happening before the pack merging and defaults loading is complete. Let me analyze the pipeline flow and propose a comprehensive solution.

## Root Cause Analysis

The timing issue stems from this sequence:

1. **Pipeline Initialization** (`PipelineCore.js`) calls `processAndValidateConfig()` which includes `mergePacks()`
2. **mergePacks()** loads and processes packs, but doesn't wait for defaults manager population
3. **SystemsManager** initializes defaults manager AFTER config processing
4. **ModelBuilder** immediately starts overlay processing without waiting for defaults to be ready
5. **StatusGridRenderer** tries to access pack defaults during first render, but they're not loaded yet

The circular dependency issue you mentioned is that overlays need the defaults manager, but the defaults manager needs the merged config, which includes overlays.

## Proposed Solution: Pipeline Sequencing Fix

Here's a comprehensive fix that addresses the timing issues by ensuring pack loading and defaults management happen **before** any overlay processing:

```javascript name=src/msd/pipeline/PipelineCore.js
import { processAndValidateConfig } from './ConfigProcessor.js';
import { SystemsManager } from './SystemsManager.js';
import { ModelBuilder } from './ModelBuilder.js';
import { setupDebugInterface } from '../debug/DebugInterface.js';
import { buildCardModel } from '../model/CardModel.js';
import { MsdApi } from '../api/MsdApi.js';
import { StatusGridRenderer } from '../renderer/StatusGridRenderer.js';
import { exportCollapsed, exportCollapsedJson } from '../export/exportCollapsed.js';
import { exportFullSnapshot, exportFullSnapshotJson } from '../export/exportFullSnapshot.js';
import { diffItem } from '../export/diffItem.js';
import { perfGetAll } from '../perf/PerfCounters.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Initialize the MSD processing/rendering pipeline.
 * ENHANCED: Ensures pack loading and defaults management complete before overlay processing
 *
 * @param {Object} userMsdConfig - User supplied MSD config.
 * @param {HTMLElement|ShadowRoot} mountEl - Mount/root element (may be a shadowRoot).
 * @param {Object|null} hass - Home Assistant instance (if available).
 * @returns {Promise<Object>} Pipeline API
 */
export async function initMsdPipeline(userMsdConfig, mountEl, hass = null) {
  cblcarsLog.debug('[PipelineCore] 🚀 Starting MSD pipeline initialization with enhanced sequencing');

  // PHASE 1: Configuration processing and pack merging
  cblcarsLog.debug('[PipelineCore] 📋 Phase 1: Processing and validating configuration');
  const { mergedConfig, issues, provenance } = await processAndValidateConfig(userMsdConfig);

  // Handle validation errors early
  if (issues.errors.length) {
    cblcarsLog.error('[PipelineCore] Validation errors – pipeline disabled', issues.errors);
    return createDisabledPipeline(mergedConfig, issues, provenance);
  }

  // PHASE 2: Initialize SystemsManager with defaults loading BEFORE any overlay processing
  cblcarsLog.debug('[PipelineCore] 🔧 Phase 2: Initializing SystemsManager and loading pack defaults');
  const systemsManager = new SystemsManager();

  // CRITICAL: Initialize systems with pack defaults loading before overlay processing
  await systemsManager.initializeSystemsWithPacksFirst(mergedConfig, mountEl, hass);

  // Verify defaults manager is ready
  if (!systemsManager.defaultsManager) {
    throw new Error('DefaultsManager initialization failed - cannot proceed with overlay rendering');
  }

  cblcarsLog.debug('[PipelineCore] ✅ Pack defaults loaded and ready:', {
    hasDefaultsManager: !!systemsManager.defaultsManager,
    packsLoaded: systemsManager.defaultsManager.getIntrospectionData().layers.pack || {}
  });

  // PHASE 3: Build card model (now safe to process overlays)
  cblcarsLog.debug('[PipelineCore] 🏗️ Phase 3: Building card model');
  const cardModel = await buildCardModel(mergedConfig);

  // Ensure anchors are available
  if (!cardModel.anchors) cardModel.anchors = {};
  if (!Object.keys(cardModel.anchors).length) {
    if (mergedConfig.anchors && Object.keys(mergedConfig.anchors).length) {
      cardModel.anchors = { ...mergedConfig.anchors };
      cblcarsLog.debug('[PipelineCore] Adopted user anchors');
    }
  }

  // PHASE 4: Complete systems initialization with card model
  cblcarsLog.debug('[PipelineCore] ⚙️ Phase 4: Completing systems initialization');
  await systemsManager.completeSystems(mergedConfig, cardModel);

  // ADDED: Set original HASS for clean controls separation
  if (hass) {
    systemsManager.setOriginalHass(hass);
  }

  // PHASE 5: Early debug and routing setup
  cblcarsLog.debug('[PipelineCore] 🔍 Phase 5: Setting up debug infrastructure');
  if (typeof window !== 'undefined') {
    window.cblcars.debug.msd = window.cblcars.debug.msd || {};
    window.cblcars.debug.msd.debugManager = systemsManager.debugManager;
    window.cblcars.debug.msd.routing = systemsManager.router;

    // Make core systems available BEFORE any overlay rendering
    window.cblcars.debug.msd.pipelineInstance = {
      systemsManager: systemsManager,
      dataSourceManager: systemsManager.dataSourceManager
    };

    cblcarsLog.debug('[PipelineCore] Essential subsystems ready for overlay rendering:', {
      hasSystemsManager: !!systemsManager,
      hasDataSourceManager: !!systemsManager.dataSourceManager,
      hasDefaultsManager: !!systemsManager.defaultsManager,
      dataSourceCount: systemsManager.dataSourceManager?.listIds?.()?.length || 0
    });

    // Dispatch routing ready event
    try {
      window.dispatchEvent(new CustomEvent('msd-routing-ready'));
    } catch (e) {
      // Non-fatal; older browsers or sandbox contexts might block custom events.
    }
  }

  // PHASE 6: Initialize model builder (now everything is ready)
  cblcarsLog.debug('[PipelineCore] 🏭 Phase 6: Initializing model builder');
  const modelBuilder = new ModelBuilder(mergedConfig, cardModel, systemsManager);

  // Store ModelBuilder reference in SystemsManager for accessibility
  systemsManager.modelBuilder = modelBuilder;

  /**
   * Internal re-render function that recomputes the model
   * and triggers the AdvancedRenderer + debug visualization pipeline.
   * @returns {Object|undefined} Renderer result object
   */
  async function reRender() {
    cblcarsLog.debug('[PipelineCore] 🔄 reRender() ENTRY', {
      timestamp: new Date().toISOString(),
      renderInProgress: systemsManager._renderInProgress,
      defaultsManagerReady: !!systemsManager.defaultsManager
    });

    // ENHANCED: Verify defaults manager is still available
    if (!systemsManager.defaultsManager) {
      cblcarsLog.error('[PipelineCore] ❌ DefaultsManager not available during re-render - aborting');
      return { success: false, error: 'DefaultsManager not available' };
    }

    // IMPROVED: Queue renders instead of blocking them
    if (systemsManager._renderInProgress) {
      cblcarsLog.debug('[PipelineCore] 🕐 Render in progress, queueing re-render');
      systemsManager._queuedReRender = true;
      return { success: false, reason: 'render_in_progress', queued: true };
    }

    systemsManager._renderInProgress = true;
    systemsManager._queuedReRender = false;

    try {
      cblcarsLog.debug('[PipelineCore] 📊 Computing resolved model...');
      const startTime = performance.now();
      const resolvedModel = modelBuilder.computeResolvedModel();

      cblcarsLog.debug('[PipelineCore] ✅ Resolved model computed:', {
        overlayCount: resolvedModel.overlays.length,
        controlOverlays: resolvedModel.overlays.filter(o => o.type === 'control').length,
        hasAnchors: !!resolvedModel.anchors,
        hasViewBox: !!resolvedModel.viewBox
      });

      cblcarsLog.debug(`[PipelineCore] 🎨 Starting AdvancedRenderer.render() - overlays: ${resolvedModel.overlays.length}`);

      // ADDED: Defensive rendering with error boundary
      let renderResult;
      try {
        renderResult = systemsManager.renderer.render(resolvedModel);
        cblcarsLog.debug('[PipelineCore] ✅ AdvancedRenderer.render() completed successfully:', renderResult);
      } catch (renderError) {
        cblcarsLog.error('[PipelineCore] ❌ AdvancedRenderer.render() FAILED:', renderError);
        cblcarsLog.error('[PipelineCore] ❌ Render error stack:', renderError.stack);
        return { success: false, error: renderError.message, phase: 'advanced_renderer' };
      }

      cblcarsLog.debug('[PipelineCore] 🎮 Starting renderDebugAndControls()...');
      // CHANGED: Make debug and controls rendering more defensive
      try {
        await systemsManager.renderDebugAndControls(resolvedModel, mountEl);
        cblcarsLog.debug('[PipelineCore] ✅ renderDebugAndControls() completed successfully');
      } catch (debugControlsError) {
        cblcarsLog.error('[PipelineCore] ❌ renderDebugAndControls() FAILED:', debugControlsError);
        cblcarsLog.error('[PipelineCore] ❌ Debug/Controls error stack:', debugControlsError.stack);
        // Don't fail the entire render - just log the error
        cblcarsLog.warn('[PipelineCore] ⚠️ Continuing without debug/controls rendering due to error');
      }

      const renderTime = performance.now() - startTime;
      cblcarsLog.debug(`[PipelineCore] ✅ reRender() COMPLETED in ${renderTime.toFixed(2)}ms`);

      return renderResult || { success: true };

    } catch (error) {
      cblcarsLog.error('[PipelineCore] ❌ reRender() COMPLETELY FAILED:', error);
      cblcarsLog.error('[PipelineCore] ❌ Complete failure stack:', error.stack);
      return { success: false, error: error.message };
    } finally {
      systemsManager._renderInProgress = false;
      cblcarsLog.debug('[PipelineCore] 🏁 reRender() FINALLY block - _renderInProgress reset to false');

      // IMPROVED: Execute queued re-render if one was requested
      if (systemsManager._queuedReRender) {
        cblcarsLog.debug('[PipelineCore] 🔄 Executing queued re-render');
        systemsManager._queuedReRender = false;
        // Use setTimeout to avoid immediate recursion and allow stack to clear
        setTimeout(() => reRender(), 50);
      }
    }
  }

  // Connect reRender callback to systems
  systemsManager.setReRenderCallback(reRender);

  // PHASE 7: Initial render - now everything is properly sequenced
  cblcarsLog.debug('[PipelineCore] 🎬 Phase 7: Performing initial render');
  cblcarsLog.debug('[PipelineCore] DataSourceManager status:', {
    sourcesCount: systemsManager.dataSourceManager?.getAllSources?.()?.length || 0,
    entityCount: systemsManager.dataSourceManager?.listIds?.()?.length || 0
  });

  const initialRenderResult = await reRender();

  cblcarsLog.debug('[PipelineCore] Initial render completed:', {
    overlayCount: initialRenderResult?.overlayCount || 0,
    errors: initialRenderResult?.errors || 0
  });

  // PHASE 8: Create pipeline API and finalize
  cblcarsLog.debug('[PipelineCore] 🔌 Phase 8: Creating pipeline API');
  const pipelineApi = createPipelineApi(
    mergedConfig, cardModel, systemsManager, modelBuilder, reRender
  );

  // Setup debug interface with DebugManager integration
  setupDebugInterface(pipelineApi, mergedConfig, provenance, systemsManager, modelBuilder);

  // Initialize HUD service with mount element
  if (typeof window !== 'undefined' && window.cblcars.debug.msd?.hud?.setMountElement) {
    window.cblcars.debug.msd.hud.setMountElement(mountEl);
  }

  // Attach unified API
  cblcarsLog.debug('[PipelineCore] Attaching unified API');
  MsdApi.attach();

  // Augment debug tracking (now that pipelineApi exists)
  if (typeof window !== 'undefined') {
    window.cblcars.debug.msd = window.cblcars.debug.msd || {};
    window.cblcars.debug.msd.validation = { issues: () => mergedConfig.__issues };
    window.cblcars.debug.msd.pipelineInstance = pipelineApi;
    window.cblcars.debug.msd._provenance = provenance;

    // Ensure routing reference is consistent (in case late changes happened)
    if (!window.cblcars.debug.msd.routing) {
      window.cblcars.debug.msd.routing = systemsManager.router;
      try {
        window.dispatchEvent(new CustomEvent('msd-routing-ready'));
      } catch(_) {}
    }
  }

  cblcarsLog.debug('[PipelineCore] ✅ Pipeline initialization complete with enhanced sequencing');
  return pipelineApi;
}

// Rest of the file remains the same...
function createDisabledPipeline(mergedConfig, issues, provenance) {
  // ... existing implementation
}

function createValidationErrorDisplay(issues, mergedConfig) {
  // ... existing implementation
}

function createPipelineApi(mergedConfig, cardModel, systemsManager, modelBuilder, reRender) {
  // ... existing implementation
}
```

Now update **SystemsManager** to support the new initialization sequence:

```javascript name=src/msd/pipeline/SystemsManager.js
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
```

Finally, update **StatusGridRenderer** to remove the fallback pack loading since defaults will always be ready:

```javascript name=src/msd/renderer/StatusGridRenderer.js
// Update the _loadPresetFromPacks method to be simpler and more reliable:

/**
 * Load preset from loaded packs via pipeline defaults manager
 * @private
 * @param {string} overlayType - Type of overlay (e.g., 'status_grid')
 * @param {string} presetName - Name of the preset
 * @returns {Object|null} Preset configuration or null if not found
 */
_loadPresetFromPacks(overlayType, presetName) {
  cblcarsLog.debug(`[StatusGridRenderer] 🔍 Loading preset ${presetName} for ${overlayType}`);

  // ENHANCED: Always check defaults manager first (should be loaded by now)
  const defaultsManager = this._resolveDefaultsManager();
  if (defaultsManager) {
    // Try to get preset through defaults system
    const presetPath = `${overlayType}.presets.${presetName}`;
    const preset = defaultsManager.resolve(presetPath);
    if (preset) {
      cblcarsLog.debug(`[StatusGridRenderer] ✅ Found preset ${presetName} via defaults manager`);
      return preset;
    }
  }

  // FALLBACK: Try to access pack data through pipeline instance
  const pipelineInstance = window.cblcars.debug.msd?.pipelineInstance;
  if (pipelineInstance && pipelineInstance.config && pipelineInstance.config.__provenance) {
    const mergeOrder = pipelineInstance.config.__provenance.merge_order;

    // Check pack layers for style presets
    for (const layer of mergeOrder) {
      if (layer.type === 'builtin') {
        try {
          const { loadBuiltinPacks } = window.loadBuiltinPacksModule || {};
          if (loadBuiltinPacks) {
            const packs = loadBuiltinPacks([layer.pack]);
            const pack = packs.find(p => p.id === layer.pack);

            if (pack && pack.style_presets && pack.style_presets[overlayType]) {
              const preset = pack.style_presets[overlayType][presetName];
              if (preset) {
                cblcarsLog.debug(`[StatusGridRenderer] ✅ Found preset ${presetName} in pack ${layer.pack} (pipeline fallback)`);
                return preset;
              }
            }
          }
        } catch (error) {
          cblcarsLog.debug(`[StatusGridRenderer] Could not load presets from pack ${layer.pack}:`, error.message);
        }
      }
    }
  }

  // LAST RESORT: Direct pack loading (should rarely be needed now)
  cblcarsLog.debug(`[StatusGridRenderer] Trying direct pack loading for preset ${presetName}`);
  try {
    const { loadBuiltinPacks } = window.loadBuiltinPacksModule || {};
    if (loadBuiltinPacks) {
      // Load the default packs directly
      const packs = loadBuiltinPacks(['core', 'cb_lcars_buttons']);

      for (const pack of packs) {
        if (pack && pack.style_presets && pack.style_presets[overlayType]) {
          const preset = pack.style_presets[overlayType][presetName];
          if (preset) {
            cblcarsLog.debug(`[StatusGridRenderer] ✅ Found preset ${presetName} in pack ${pack.id} (direct fallback)`);
            return preset;
          }
        }
      }
    }
  } catch (error) {
    cblcarsLog.debug(`[StatusGridRenderer] Direct pack loading failed:`, error.message);
  }

  // If we get here, preset wasn't found anywhere
  cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Preset ${presetName} not found in any packs`);
  return null;
}

// Remove or simplify the _shouldWaitForPipeline method since we no longer need to wait:
_shouldWaitForPipeline(overlay) {
  // With the new sequencing, defaults should always be ready by the time overlays render
  // Keep basic safety check but don't schedule retries
  const defaultsManager = this._resolveDefaultsManager();
  if (!defaultsManager) {
    cblcarsLog.warn('[StatusGridRenderer] ⚠️ DefaultsManager not available - this should not happen with new sequencing');
    return true;
  }
  return false;
}
```

## Summary

This solution addresses the timing issue by:

1. **Sequenced Initialization**: PipelineCore now uses a phased approach where pack loading and defaults management happen **before** any overlay processing begins.

2. **Split SystemsManager Initialization**: Two-phase initialization ensures defaults are loaded before overlays need them:
   - Phase 1: Load packs and initialize defaults manager
   - Phase 2: Complete other systems after overlays can safely be processed

3. **Eliminated Circular Dependencies**: Defaults loading happens independently of overlay processing, breaking the circular dependency.

4. **Simplified StatusGridRenderer**: No more fallback pack loading needed since defaults will always be ready.

5. **Enhanced Error Handling**: Better validation that defaults are available at each step.

This approach ensures that by the time any overlay renderer is called, the pack defaults are already loaded and available through the defaults manager, eliminating the timing race condition you've been experiencing.