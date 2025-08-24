import { isMsdV1Enabled, MSD_V1_ENABLE } from './featureFlags.js';
import { mergePacks } from './packs/mergePacks.js';
import { validateMerged } from './validation/validateMerged.js';
import { buildCardModel } from './model/CardModel.js';
import { RulesEngine, applyOverlayPatches } from './rules/RulesEngine.js';
import { resolveValueMaps } from './valueMap/resolveValueMaps.js';
import { AnimationRegistry } from './animation/AnimationRegistry.js';
import { perfGetAll, perfTime } from './perf/PerfCounters.js';
import { deepMerge } from './util/deepMerge.js';
import { buildProfileIndex, assembleOverlayBaseStyle } from './profiles/applyProfiles.js';
import { resolveDesiredAnimations } from './animation/resolveAnimations.js';
import { resolveDesiredTimelines } from './animation/resolveTimelines.js';
import { listAnimationPresets, registerAnimationPreset } from './animation/presets.js';
import { exportCollapsed, exportCollapsedJson } from './export/exportCollapsed.js';
import { exportFullSnapshot, exportFullSnapshotJson } from './export/exportFullSnapshot.js';
import { diffItem } from './export/diffItem.js';
import { Router } from './routing/Router.js';
import { RouterCore } from './routing/RouterCore.js';
import { EntityRuntime } from './entities/EntityRuntime.js';

// CRITICAL: Import our Phase 1-4 refactored systems - NO autoRegister.js import
import { AdvancedRenderer } from './renderer/AdvancedRenderer.js';
import { MsdIntrospection } from './introspection/MsdIntrospection.js';
import { MsdHudManager } from './hud/MsdHudManager.js';
import { MsdControlsRenderer } from './controls/MsdControlsRenderer.js';
import { MsdApi } from './api/MsdApi.js';

// FIXED: Use ES6 import instead of require
import { MsdDebugRenderer } from './debug/MsdDebugRenderer.js';

import "./tests/routingScenarios.js"
import "./tests/smartRoutingScenarios.js"
import "./tests/channelsRoutingScenarios.js"
import "./tests/arcsRoutingScenarios.js";
import "./tests/smoothingRoutingScenarios.js";
import "./hud/hudService.js";

export async function initMsdPipeline(userMsdConfig, mountEl) {
  if (!isMsdV1Enabled()) return { enabled: false };

  const mergedConfig = await mergePacks(userMsdConfig);
  const provenance = mergedConfig.__provenance;

  // Store original user config in debug namespace
  if (typeof window !== 'undefined') {
    window.__msdDebug = window.__msdDebug || {};
    window.__msdDebug._originalUserConfig = userMsdConfig;
  }

  // Validation pass
  const t0 = performance.now();
  const issues = validateMerged(mergedConfig);
  mergedConfig.__issues = issues;
  const t1 = performance.now();
  try { window.__msdDebug && (window.__msdDebug._validationMs = (t1 - t0)); } catch {}

  // Anchor validation
  try {
    const existingCodes = new Set(issues.errors.map(e=>e.code));
    const anchorSet = new Set(Object.keys(mergedConfig.anchors || {}));
    (mergedConfig.overlays || []).forEach(o=>{
      if (!o || !o.id) return;
      const aRefs = [];
      if (typeof o.anchor === 'string') aRefs.push(o.anchor);
      if (typeof o.attach_to === 'string') aRefs.push(o.attach_to);
      if (typeof o.attachTo === 'string') aRefs.push(o.attachTo);
      aRefs.forEach(ref=>{
        if (ref && !anchorSet.has(ref)) {
          const code = 'anchor.missing';
          if (!existingCodes.has(`${code}:${ref}:${o.id}`)) {
            issues.errors.push({ code, severity:'error', overlay:o.id, anchor:ref, msg:`Overlay ${o.id} references missing anchor '${ref}'` });
            existingCodes.add(`${code}:${ref}:${o.id}`);
          }
        }
      });
    });
  } catch(_) {}

  if (issues.errors.length) {
    console.error('[MSD v1] Validation errors – pipeline disabled', issues.errors);

    const disabledPipeline = {
      enabled: false,
      errors: issues.errors,
      warnings: issues.warnings,
      getResolvedModel: () => null,
      ingestHass: () => {},
      updateEntities: () => {},
      listEntities: () => [],
      getEntity: () => null,
      getActiveProfiles: () => [],
      getAnchors: () => (mergedConfig.anchors || {}),
      repairAnchorsFromMerged: () => false,
      exportCollapsed: () => null,
      exportCollapsedJson: () => 'null',
      exportFullSnapshot: () => null,
      exportFullSnapshotJson: () => 'null',
      diffItem: () => null,
      getPerf: () => ({})
    };

    if (typeof window !== 'undefined') {
      window.__msdDebug = window.__msdDebug || {};
      window.__msdDebug.validation = { issues: () => mergedConfig.__issues };
      window.__msdDebug.pipelineInstance = disabledPipeline;
      window.__msdDebug.pipeline = { merged: mergedConfig };
      window.__msdDebug._provenance = provenance;
    }
    return disabledPipeline;
  }

  const cardModel = await buildCardModel(mergedConfig);

  // Normalize anchors container
  if (!cardModel.anchors) cardModel.anchors = {};

  // Adopt user anchors if CardModel extracted none
  if (!Object.keys(cardModel.anchors).length) {
    if (mergedConfig.anchors && Object.keys(mergedConfig.anchors).length) {
      cardModel.anchors = { ...mergedConfig.anchors };
      console.info('[MSD v1] Adopted user anchors (no extracted SVG anchors available). Count=', Object.keys(cardModel.anchors).length);
    } else {
      console.warn('[MSD v1] No anchors available (neither SVG nor user). Lines will skip until anchors defined.');
    }
  }

  const rulesEngine = new RulesEngine(mergedConfig.rules);
  rulesEngine.markAllDirty();

  // Rules dependency index + perf counters instrumentation
  (function instrumentRules(){
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
      rulesEngine.__hudDeps = depIndex;

      const W = typeof window!=='undefined'?window:{};
      W.__msdDebug = W.__msdDebug || {};
      const perfStore = W.__msdDebug.__perfStore = W.__msdDebug.__perfStore || { counters:{}, timings:{} };
      function perfCount(k,inc=1){ perfStore.counters[k]=(perfStore.counters[k]||0)+inc; }

      if (!rulesEngine.__perfWrapped && typeof rulesEngine.evaluateDirty === 'function'){
        const orig = rulesEngine.evaluateDirty;
        rulesEngine.evaluateDirty = function(){
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
        rulesEngine.__perfWrapped = true;
      }
    } catch(e){
      console.warn('[MSD v1][rules instrumentation] failed', e);
    }
  })();

  const profileIndex = buildProfileIndex(mergedConfig.profiles);
  let runtimeActiveProfiles = Array.isArray(mergedConfig.active_profiles) ? mergedConfig.active_profiles.slice() : [];

  const animRegistry = new AnimationRegistry();
  const animationIndex = new Map((mergedConfig.animations || []).map(a => [a.id, a]));
  const timelineDefs = mergedConfig.timelines || [];

  const router = new RouterCore(mergedConfig.routing, cardModel.anchors, cardModel.viewBox);

  // CRITICAL FIX: Pass RouterCore to AdvancedRenderer constructor
  console.log('[MSD v1] Using AdvancedRenderer for overlay system');
  const renderer = new AdvancedRenderer(mountEl, router); // FIXED: Pass router as second parameter

  // CRITICAL FIX: Initialize our Phase 1-4 refactored systems
  console.log('[MSD v1] Initializing refactored debug and controls systems');
  const debugRenderer = new MsdDebugRenderer();
  const controlsRenderer = new MsdControlsRenderer(renderer);
  const hudManager = new MsdHudManager(); // UPDATED: Use the real MsdHudManager

  // ENHANCED: Entity runtime with render deduplication
  const entityRuntime = new EntityRuntime((changedIds) => {
    console.log('[MSD v1] Entity changes detected:', changedIds);
    rulesEngine.markEntitiesDirty(changedIds);

    // ENHANCED: Debounce renders to prevent excessive re-rendering
    if (this._renderTimeout) {
      clearTimeout(this._renderTimeout);
    }
    this._renderTimeout = setTimeout(() => {
      reRender();
      this._renderTimeout = null;
    }, 100); // 100ms debounce
  });

  let resolvedModel;
  let _resolvedModelRef = null;

  function computeResolvedModel() {
    // Anchor repair diagnostic
    if (!cardModel.anchors || Object.keys(cardModel.anchors).length === 0) {
      if (mergedConfig.anchors && Object.keys(mergedConfig.anchors).length) {
        console.warn('[MSD v1] computeResolvedModel: anchors missing – repairing from merged.anchors');
        cardModel.anchors = { ...mergedConfig.anchors };
      } else {
        console.warn('[MSD v1] computeResolvedModel: anchors missing and no merged fallback available.');
      }
    }

    // FIXED: Profiles/base style assembly - preserve all overlay properties
    const baseOverlays = perfTime('profiles.assemble', () =>
      cardModel.overlaysBase.map(o => {
        const { style, sources } = assembleOverlayBaseStyle(o, runtimeActiveProfiles, profileIndex);

        // CRITICAL FIX: Preserve ALL properties from raw overlay config
        const resolvedOverlay = {
          id: o.id,
          type: o.type,
          style,
          finalStyle: { ...style },
          _styleSources: sources,
          _raw: o.raw,
          anchor: o.raw?.anchor,
          attach_to: o.raw?.attach_to,
          position: o.raw?.position,
          size: o.raw?.size
        };

        // FIXED: Preserve data source and other critical properties
        if (o.raw?.source) {
          resolvedOverlay.source = o.raw.source;
        }

        // FIXED: Preserve routing properties
        if (o.raw?.route) {
          resolvedOverlay.route = o.raw.route;
        }

        // ENHANCED: Debug what properties are being preserved
        const originalKeys = Object.keys(o.raw || {});
        const preservedKeys = Object.keys(resolvedOverlay);

        if (originalKeys.includes('source')) {
          console.log(`[MSD v1] Overlay ${o.id} source preservation:`, {
            originalSource: o.raw?.source,
            preservedSource: resolvedOverlay.source,
            hasSource: !!resolvedOverlay.source
          });
        }

        return resolvedOverlay;
      })
    );

    // Rules
    const ruleResult = rulesEngine.evaluateDirty({
      getEntity: id => entityRuntime.getEntity(id)
    });

    // Profiles add/remove
    if (ruleResult.profilesAdd?.length || ruleResult.profilesRemove?.length) {
      const set = new Set(runtimeActiveProfiles);
      ruleResult.profilesAdd.forEach(p => set.add(p));
      ruleResult.profilesRemove.forEach(p => set.delete(p));
      runtimeActiveProfiles = Array.from(set);
    }

    // Apply overlay patches
    const overlaysWithPatches = perfTime('styles.patch', () =>
      applyOverlayPatches(baseOverlays, ruleResult.overlayPatches)
    );

    // Value_map substitutions
    perfTime('value_map.subst', () =>
      resolveValueMaps(overlaysWithPatches, {
        getEntity: id => entityRuntime.getEntity(id)
      })
    );

    // Animations
    const desiredAnimations = resolveDesiredAnimations(overlaysWithPatches, animationIndex, ruleResult.animations);
    const desiredTimelines = resolveDesiredTimelines(timelineDefs);
    const activeAnimations = [];
    desiredAnimations.forEach(animDef => {
      const instance = animRegistry.getOrCreateInstance(animDef.definition, animDef.targets);
      if (instance) {
        activeAnimations.push({
          id: animDef.id,
          instance,
          hash: animRegistry.computeInstanceHash(animDef.definition)
        });
      }
    });
    const animDiff = { active: activeAnimations };
    const tlDiff = { active: desiredTimelines };

    // Assign animation hash to overlays
    const overlayAnimByKey = new Map();
    animDiff.active.forEach(a => {
      if (a.overlayId) overlayAnimByKey.set(a.overlayId, a.hash);
    });
    overlaysWithPatches.forEach(o => {
      const h = overlayAnimByKey.get(o.id);
      if (h) o.animation_hash = h;
    });

    const resolved = {
      viewBox: cardModel.viewBox,
      anchors: { ...cardModel.anchors },
      overlays: overlaysWithPatches,
      animations: animDiff.active,
      timelines: tlDiff.active,
      active_profiles: runtimeActiveProfiles.slice()
    };

    try { router.setOverlays && router.setOverlays(resolved.overlays); } catch(_) {}
    _resolvedModelRef = resolved;
    return resolved;
  }

  function reRender() {
    const startTime = performance.now();

    resolvedModel = computeResolvedModel();

    console.log(`[MSD v1] Re-rendering with AdvancedRenderer - overlays: ${resolvedModel.overlays.length}`);
    const renderResult = renderer.render(resolvedModel);

    const renderTime = performance.now() - startTime;
    console.log(`[MSD v1] Render completed in ${renderTime.toFixed(2)}ms`);

    // ADDED: Render debug visualization if flags enabled
    const debugFlags = getDebugFlags();
    if (shouldRenderDebug(debugFlags)) {
      console.log('[MSD v1] Rendering debug visualization');
      debugRenderer.render(resolvedModel, debugFlags);
    }

    // ADDED: Render controls if any exist
    const controlOverlays = resolvedModel.overlays.filter(o => o.type === 'control');
    if (controlOverlays.length > 0) {
      console.log('[MSD v1] Rendering control overlays:', controlOverlays.length);
      controlsRenderer.renderControls(controlOverlays, resolvedModel);
    }

    return renderResult;
  }

  // Helper functions for debug integration
  function getDebugFlags() {
    return window.cblcars?._debugFlags || {};
  }

  function shouldRenderDebug(debugFlags) {
    return debugFlags && (debugFlags.overlay || debugFlags.connectors || debugFlags.geometry);
  }

  // Initial compute + render
  console.log('[MSD v1] Computing initial resolved model');
  resolvedModel = computeResolvedModel();
  console.log('[MSD v1] Initial render - overlays to render:', resolvedModel.overlays.length);
  reRender();

  // Public ingestion helpers
  function ingestHass(hass) {
    if (!hass) {
      console.warn('[MSD v1] ingestHass called without hass');
      return;
    }
    if (!hass.states) {
      console.warn('[MSD v1] ingestHass called without hass.states, hass keys:', Object.keys(hass));
      return;
    }

    const stateKeys = Object.keys(hass.states);
    console.log('[MSD v1] HASS ingestion - states available:', stateKeys.length);

    // ENHANCED: Deep structure analysis
    if (stateKeys.length > 0) {
      const firstEntity = hass.states[stateKeys[0]];
      console.log('[MSD v1] Sample HASS entity structure analysis:');
      console.log('Entity ID:', stateKeys[0]);
      console.log('Entity keys:', Object.keys(firstEntity || {}));
      console.log('Entity state:', firstEntity?.state);
      console.log('Entity attributes type:', typeof firstEntity?.attributes);
      console.log('Entity has last_changed:', !!firstEntity?.last_changed);
      console.log('Entity has last_updated:', !!firstEntity?.last_updated);

      // Check if this is the expected format
      const expectedFormat = firstEntity &&
                           typeof firstEntity.state !== 'undefined' &&
                           typeof firstEntity.attributes === 'object';
      console.log('[MSD v1] HASS data format check:', expectedFormat ? 'VALID' : 'INVALID');

      if (!expectedFormat) {
        console.error('[MSD v1] HASS entity format mismatch!');
        console.log('[MSD v1] Expected: { state: any, attributes: object }');
        console.log('[MSD v1] Actual:', firstEntity);
      }
    }

    // Track before/after entity counts
    const beforeCount = entityRuntime.listIds().length;
    console.log('[MSD v1] EntityRuntime before ingestion:', beforeCount, 'entities');

    try {
      entityRuntime.ingestHassStates(hass.states);
      console.log('[MSD v1] EntityRuntime.ingestHassStates completed successfully');
    } catch (error) {
      console.error('[MSD v1] EntityRuntime.ingestHassStates failed:', error);
      console.error('[MSD v1] Error stack:', error.stack);
      return;
    }

    // Log results of ingestion
    const afterCount = entityRuntime.listIds().length;
    const entityStats = entityRuntime.stats();

    console.log('[MSD v1] EntityRuntime after ingestion:', afterCount, 'entities');
    console.log('[MSD v1] Ingestion delta:', afterCount - beforeCount, 'new entities');
    console.log('[MSD v1] EntityRuntime stats:', entityStats);

    // If ingestion failed completely, investigate
    if (stateKeys.length > 0 && afterCount === beforeCount) {
      console.error('[MSD v1] ZERO entities ingested despite', stateKeys.length, 'available');

      // Try ingesting just one entity to debug
      console.log('[MSD v1] Testing single entity ingestion...');
      const testEntity = {};
      testEntity[stateKeys[0]] = hass.states[stateKeys[0]];

      try {
        entityRuntime.ingestHassStates(testEntity);
        const singleTestResult = entityRuntime.listIds().length;
        console.log('[MSD v1] Single entity test result:', singleTestResult, 'entities');

        if (singleTestResult > afterCount) {
          console.error('[MSD v1] EntityRuntime can ingest individual entities but not bulk data');
          console.log('[MSD v1] This suggests a bulk processing issue in EntityRuntime');
        }
      } catch (singleError) {
        console.error('[MSD v1] Single entity ingestion also failed:', singleError);
      }
    }

    // Sample some ingested entities
    if (afterCount > 0) {
      const sampleIds = entityRuntime.listIds().slice(0, 3);
      console.log('[MSD v1] Sample ingested entities:');
      sampleIds.forEach(id => {
        const entity = entityRuntime.getEntity(id);
        console.log(`  ${id}:`, entity?.state, Object.keys(entity?.attributes || {}));
      });
    }
  }

  function updateEntities(map) {
    if (!map || typeof map !== 'object') return;

    console.log('[MSD v1] Manual entity update:', Object.keys(map).length, 'entities');
    const synthetic = {};
    Object.keys(map).forEach(id => {
      const cur = map[id];
      synthetic[id] = {
        state: cur?.state !== undefined ? cur.state : cur,
        attributes: cur?.attributes || {}
      };
    });
    entityRuntime.ingestHassStates(synthetic);
  }

  const pipelineApi = {
    enabled: true,
    merged: mergedConfig,
    cardModel,
    rulesEngine,
    renderer,
    animRegistry,
    router,
    routingInspect: (id) => {
      const ov = (resolvedModel?.overlays||[]).find(o=>o.id===id);
      if (!ov) return null;
      const raw = ov._raw || ov.raw || {};
      const a1 = cardModel.anchors[raw.anchor];
      const a2 = cardModel.anchors[raw.attach_to] || cardModel.anchors[raw.attachTo];
      if (!a1 || !a2) return null;
      const req = router.buildRouteRequest(ov, a1, a2);
      return router.computePath(req);
    },
    getResolvedModel: () => _resolvedModelRef,
    setAnchor(id, pt) {
      if (!id || !Array.isArray(pt) || pt.length !== 2) return false;
      if (!cardModel.anchors) cardModel.anchors = {};
      cardModel.anchors[id] = [Number(pt[0]), Number(pt[1])];
      if (_resolvedModelRef?.anchors) _resolvedModelRef.anchors[id] = cardModel.anchors[id];
      router.invalidate && router.invalidate('*');
      try {
        if (this.renderer && _resolvedModelRef) {
          this.renderer._routerOverlaySync = false;
          this.renderer.render(_resolvedModelRef);
        }
      } catch(_) {}
      return true;
    },
    ingestHass,
    updateEntities,
    listEntities: () => entityRuntime.listIds(),
    getEntity: (id) => entityRuntime.getEntity(id),
    getActiveProfiles: () => runtimeActiveProfiles.slice(),
    getAnchors: () => ({ ...cardModel.anchors }),
    exportCollapsed: () => exportCollapsed(userMsdConfig),
    exportCollapsedJson: () => JSON.stringify(exportCollapsed(userMsdConfig)),
    exportFullSnapshot: () => exportFullSnapshot(mergedConfig),
    exportFullSnapshotJson: () => JSON.stringify(exportFullSnapshot(mergedConfig)),
    diffItem: (item) => diffItem(item),
    getPerf: () => perfGetAll()
  };

  // CRITICAL: Debug exposure with our Phase 1-4 systems properly integrated
  if (typeof window !== 'undefined') {
    const dbg = window.__msdDebug = window.__msdDebug || {};
    dbg.featureFlags = dbg.featureFlags || {};
    dbg.featureFlags.MSD_V1_ENABLE = MSD_V1_ENABLE;
    dbg.pipelineInstance = pipelineApi;
    dbg.pipeline = { merged: mergedConfig, cardModel, rulesEngine, router };
    dbg._provenance = provenance;
    dbg.rules = dbg.rules || { trace: () => rulesEngine.getTrace() };
    dbg.updateEntities = updateEntities;
    dbg.animations = dbg.animations || {
      active: () => animRegistry.getActive()
    };
    dbg.routing = dbg.routing || {};
    dbg.routing.inspect = (id) => pipelineApi.routingInspect(id);
    dbg.routing.invalidate = (id='*') => router.invalidate(id);
    dbg.routing.stats = () => router.stats();
    dbg.routing.inspectAs = (id, modeFull='smart') => {
      try {
        const model = pipelineApi.getResolvedModel?.();
        if (!model) return null;
        const ov = model.overlays.find(o => o.id === id);
        if (!ov) return null;
        ov._raw = ov._raw || {};
        const original = ov._raw.route_mode_full;
        ov._raw.route_mode_full = modeFull;
        pipelineApi.router.invalidate && pipelineApi.router.invalidate('*');
        const res = dbg.routing.inspect(id);
        ov._raw.route_mode_full = original;
        pipelineApi.router.invalidate && pipelineApi.router.invalidate('*');
        return res;
      } catch (e) {
        console.warn('[MSD v1] inspectAs failed', e);
        return null;
      }
    };
    // FIXED: Add missing getPerf function that panels expect
    dbg.getPerf = () => {
      const perfStore = dbg.__perfStore || {};
      const result = {
        timers: {},
        counters: perfStore.counters || {}
      };

      // Convert timing data to expected format
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

    // FIXED: Connect entities API to EntityRuntime with correct method names
    dbg.entities = {
      list: () => {
        try {
          const ids = entityRuntime?.listIds?.() || [];
          return ids;
        } catch (e) {
          console.warn('[MSD v1] entities.list failed:', e);
          return [];
        }
      },
      get: (id) => {
        try {
          const entity = entityRuntime?.getEntity?.(id) || null;
          return entity;
        } catch (e) {
          console.warn(`[MSD v1] entities.get(${id}) failed:`, e);
          return null;
        }
      },
      stats: () => {
        try {
          const runtimeStats = entityRuntime?.stats?.() || {};
          const entityCount = entityRuntime?.listIds?.()?.length || 0;
          const stats = {
            count: entityCount,
            subscribed: runtimeStats.subscribed || 0,
            updated: runtimeStats.updated || 0,
            cacheHits: runtimeStats.cacheHits || 0,
            ...runtimeStats
          };
          return stats;
        } catch (e) {
          console.warn('[MSD v1] entities.stats failed:', e);
          return { count: 0, subscribed: 0, updated: 0, error: e.message };
        }
      },
      ingest: (statesObj) => {
        try {
          console.log('[MSD v1] Manual entity ingestion:', Object.keys(statesObj || {}).length, 'entities');
          return entityRuntime?.ingestHassStates?.(statesObj || {});
        } catch (e) {
          console.warn('[MSD v1] entities.ingest failed:', e);
        }
      },
      // ADDED: Debug method to check ingestion
      testIngestion: () => {
        const testStates = {
          'sensor.test_entity': {
            state: '42',
            attributes: { unit: 'test' },
            last_changed: new Date().toISOString(),
            last_updated: new Date().toISOString()
          }
        };
        console.log('[MSD v1] Testing entity ingestion...');
        entityRuntime.ingestHassStates(testStates);
        const result = entityRuntime.getEntity('sensor.test_entity');
        console.log('[MSD v1] Test result:', result);
        return result;
      }
    };

    // FIXED: Connect validation API properly
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

    // FIXED: Ensure routing API is properly connected
    dbg.routing = dbg.routing || {};
    dbg.routing.inspect = (id) => pipelineApi.routingInspect(id);
    dbg.routing.invalidate = (id='*') => router.invalidate(id);
    dbg.routing.stats = () => {
      try {
        return router.stats?.() || { cacheHits: 0, pathsComputed: 0, invalidations: 0 };
      } catch (e) {
        console.warn('[MSD v1] routing.stats failed:', e);
        return { cacheHits: 0, pathsComputed: 0, invalidations: 0, error: e.message };
      }
    };

    dbg.lines = dbg.lines || {
      markersEnabled: false,
      showMarkers(flag=true){
        this.markersEnabled=!!flag;
        console.info('[MSD v1] line endpoint markers', this.markersEnabled?'ENABLED':'DISABLED');
      },
      forceRedraw: () => {
        reRender();
        return true;
      }
    };
    dbg.validation = {
      issues: () => mergedConfig.__issues
    };
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
    dbg.perf = () => perfGetAll();

    // CRITICAL FIX: Wire up our Phase 1-4 systems to the main debug interface
    console.log('[MSD v1] Wiring refactored systems to window.__msdDebug interface');

    dbg.renderAdvanced = (options) => {
      try {
        console.log('[MSD v1] renderAdvanced called - using AdvancedRenderer');
        const model = pipelineApi.getResolvedModel();
        if (model) {
          return renderer.render(model);
        }
        console.warn('[MSD v1] renderAdvanced: No resolved model available');
        return { svgMarkup: '' };
      } catch (error) {
        console.error('[MSD v1] renderAdvanced failed:', error);
        return { svgMarkup: '', error: error.message };
      }
    };

    dbg.debug = dbg.debug || {};
    dbg.debug.render = (root, viewBox, options) => {
      try {
        console.log('[MSD v1] debug.render called - using MsdDebugRenderer');
        console.log('[MSD v1] debug.render params:', {
          rootType: typeof root,
          hasQuerySelector: typeof root?.querySelector === 'function',
          viewBox,
          optionsKeys: Object.keys(options || {})
        });

        const flags = getDebugFlags();
        if (shouldRenderDebug(flags)) {
          const model = pipelineApi.getResolvedModel();
          if (model) {
            // REVERTED: Pass the correct parameters to debug renderer like before
            debugRenderer.render(root, viewBox, {
              anchors: options?.anchors || model.anchors || {}
            });
          } else {
            console.warn('[MSD v1] debug.render: No resolved model available');
          }
        } else {
          console.log('[MSD v1] debug.render: No debug flags enabled, flags:', flags);
        }
      } catch (error) {
        console.warn('[MSD v1] debug.render failed:', error);
        console.warn('[MSD v1] debug.render error stack:', error.stack);
      }
    };

    dbg.hud = dbg.hud || {};
    dbg.hud.show = () => {
      try {
        console.log('[MSD v1] hud.show called - using MsdHudManager');
        hudManager.show();
      } catch (error) {
        console.warn('[MSD v1] hud.show failed:', error);
      }
    };

    dbg.hud.hide = () => {
      try {
        console.log('[MSD v1] hud.hide called');
        hudManager.hide();
      } catch (error) {
        console.warn('[MSD v1] hud.hide failed:', error);
      }
    };

    dbg.hud.toggle = () => {
      try {
        hudManager.toggle();
      } catch (error) {
        console.warn('[MSD v1] hud.toggle failed:', error);
      }
    };

    dbg.hud.state = () => ({
      visible: hudManager.state?.visible || false,
      activePanel: hudManager.state?.activePanel || 'unknown',
      refreshRate: hudManager.state?.refreshRate || 2000
    });

    // ADDED: Expose introspection utilities
    dbg.introspection = {
      listOverlays: (root) => MsdIntrospection.listOverlays(root),
      getOverlayBBox: (id, root) => MsdIntrospection.getOverlayBBox(id, root),
      highlight: (ids, opts) => MsdIntrospection.highlight(ids, opts)
    };

    // ADDED: Expose controls renderer
    dbg.controls = {
      render: (overlays, model) => controlsRenderer.renderControls(overlays, model),
      relayout: () => controlsRenderer.relayout()
    };

    console.log('[MSD v1] Debug interface setup complete');
    console.log('[MSD v1] Available methods:', Object.keys(dbg));
  }

  // CRITICAL: Attach unified API (this creates window.cblcars.msd.api)
  console.log('[MSD v1] Attaching unified API');
  MsdApi.attach();

  console.log('[MSD v1] Pipeline initialization complete');
  console.log('[MSD v1] Final pipeline state:', {
    enabled: true,
    overlays: resolvedModel.overlays.length,
    anchors: Object.keys(resolvedModel.anchors).length,
    renderer: renderer.constructor.name
  });

  return pipelineApi;
}

export function initMsdHud(pipeline, mountEl) {
  if (!pipeline?.enabled) return null;
  import('./hud/HudController.js').then(mod => {
    const hud = new mod.HudController(pipeline, mountEl);
    hud.refresh();
    if (window.__msdDebug) {
      window.__msdDebug.hud = {
        refresh: () => hud.refresh(),
        hud
      };
    }
  }).catch(err => {
    console.warn('[MSD v1] HudController import failed:', err);
  });
}

export async function processMsdConfig(userMsdConfig) {
  try {
    const preValidation = validateMerged(userMsdConfig);
    const mergedConfig = await mergePacks(userMsdConfig);
    const postValidation = validateMerged(mergedConfig);

    const issues = {
      errors: [...preValidation.errors, ...postValidation.errors],
      warnings: [...preValidation.warnings, ...postValidation.warnings]
    };

    if (issues.errors.length > 0) {
      console.error('MSD validation errors:', issues.errors);
    }

    if (issues.warnings.length > 0) {
      console.warn('MSD validation warnings:', issues.warnings);
    }

    return {
      config: mergedConfig,
      validation: issues
    };

  } catch (error) {
    console.error('MSD processing failed:', error);
    throw error;
  }
}

// Export individual functions for direct testing
export { mergePacks };
export { validateMerged };

// Debug exposure
(function attachDebug() {
  if (typeof window === 'undefined') return;
  window.__msdDebug = window.__msdDebug || {};
  Object.assign(window.__msdDebug, {
    mergePacks,
    buildCardModel,
    initMsdPipeline,
    initMsdHud
  });
  window.__msdDebug.featureFlags = window.__msdDebug.featureFlags || {};
  window.__msdDebug.featureFlags.MSD_V1_ENABLE = MSD_V1_ENABLE;
})();
