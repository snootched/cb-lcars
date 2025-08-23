import { isMsdV1Enabled, MSD_V1_ENABLE } from './featureFlags.js';
import { mergePacks } from './packs/mergePacks.js';
import { validateMerged } from './validation/validateMerged.js';
import { buildCardModel } from './model/CardModel.js';
import { RulesEngine, applyOverlayPatches } from './rules/RulesEngine.js';
import { resolveValueMaps } from './valueMap/resolveValueMaps.js';
import { AnimationRegistry } from './animation/AnimationRegistry.js';
import { RendererV1 } from './render/RendererV1.js';
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

import "./tests/routingScenarios.js"
import "./tests/smartRoutingScenarios.js"
import "./tests/channelsRoutingScenarios.js"   // ensure shaping scenarios included
import "./tests/arcsRoutingScenarios.js"; // M5.5 arc scenarios
import "./tests/smoothingRoutingScenarios.js"; // NEW M5.6 smoothing scenarios
import "./hud/hudService.js";  // Wave 6 HUD skeleton

export async function initMsdPipeline(userMsdConfig, mountEl) {
  if (!isMsdV1Enabled()) return { enabled: false };
  const { merged: mergedConfig, provenance } = await mergePacks(userMsdConfig); // CHANGED: destructure
  mergedConfig.__raw_msd = userMsdConfig;
  mergedConfig.__provenance = provenance; // optional debug attachment
  // Validation pass
  const t0 = performance.now();
  const issues = validateMerged(mergedConfig);          // CHANGED: pass plain merged config
  mergedConfig.__issues = issues;
  const t1 = performance.now();
  try { window.__msdDebug && (window.__msdDebug._validationMs = (t1 - t0)); } catch {}

  // --- NEW: anchor.missing validation (Wave 2) ---
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
  // re-check for disable after anchor errors
  if (issues.errors.length && !issues._postAnchorScan) {
    issues._postAnchorScan = true;
  }
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
      window.__msdDebug._provenance = provenance; // CHANGED
    }
    return disabledPipeline;
  }
  const cardModel = await buildCardModel(mergedConfig); // CHANGED

  // Normalize anchors container
  if (!cardModel.anchors) cardModel.anchors = {};

  // Adopt user anchors if CardModel extracted none (common when base_svg not yet loaded in hybrid mode)
  if (!Object.keys(cardModel.anchors).length) {
    if (mergedConfig.anchors && Object.keys(mergedConfig.anchors).length) {
      cardModel.anchors = { ...mergedConfig.anchors };
      console.info('[MSD v1] Adopted user anchors (no extracted SVG anchors available). Count=', Object.keys(cardModel.anchors).length);
    } else {
      console.warn('[MSD v1] No anchors available (neither SVG nor user). Lines will skip until anchors defined.');
    }
  }

  // Debug: log final anchor keys once
  if (typeof window !== 'undefined') {
    (window.__msdDebugAnchorsLogged ||= false);
    if (!window.__msdDebugAnchorsLogged) {
      window.__msdDebugAnchorsLogged = true;
      console.info('[MSD v1] Anchors (final after build)=', Object.keys(cardModel.anchors || {}));
    }
  }

  const rulesEngine = new RulesEngine(mergedConfig.rules);
  rulesEngine.markAllDirty();
  // --- NEW: rules dependency index + perf counters instrumentation (Wave 2 scaffold) ---
  (function instrumentRules(){
    try {
      // Build simple dependency index: scan rule.when.* for entity keys
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
      // Ensure perf store
      const W = typeof window!=='undefined'?window:{};
      W.__msdDebug = W.__msdDebug || {};
      const perfStore = W.__msdDebug.__perfStore = W.__msdDebug.__perfStore || { counters:{}, timings:{} };
      function perfCount(k,inc=1){ perfStore.counters[k]=(perfStore.counters[k]||0)+inc; }
      // Wrap evaluateDirty (idempotent)
      if (!rulesEngine.__perfWrapped && typeof rulesEngine.evaluateDirty === 'function'){
        const orig = rulesEngine.evaluateDirty;
        rulesEngine.evaluateDirty = function(){
          const ruleCount = (mergedConfig.rules||[]).length;
          perfCount('rules.eval.count', ruleCount||0);
          const res = orig.apply(this, arguments);
          try {
            // Attempt to infer matches (fallback 0)
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
  const renderer = new RendererV1(mountEl, router);

  // Entity runtime (must exist before first compute)
  const entityRuntime = new EntityRuntime((changedIds) => {
    rulesEngine.markEntitiesDirty(changedIds);
    reRender();
  });

  // DEBUG namespace early (ensures YAML bootstrap diagnostics can see stubs)
  if (typeof window !== 'undefined') {
    window.__msdDebug = window.__msdDebug || {};
    if (!window.__msdDebug.entities) {
      window.__msdDebug.entities = {
        list: () => [],
        get: () => null,
        stats: () => ({ total: 0, pending: 0 }),
        ingest: () => {}
      };
    }
  }

  let resolvedModel;
  let _resolvedModelRef = null;          // NEW: holds last resolved model

  function computeResolvedModel() {
    // DIAGNOSTIC: ensure anchors still present; if lost, repair & log.
    if (!cardModel.anchors || Object.keys(cardModel.anchors).length === 0) {
      if (mergedConfig.anchors && Object.keys(mergedConfig.anchors).length) {
        console.warn('[MSD v1] computeResolvedModel: anchors missing – repairing from merged.anchors');
        cardModel.anchors = { ...mergedConfig.anchors };
      } else {
        console.warn('[MSD v1] computeResolvedModel: anchors missing and no merged fallback available.');
      }
    }
    // Extra sanity log (once)
    if (!computeResolvedModel._anchorsLoggedOnce) {
      computeResolvedModel._anchorsLoggedOnce = true;
      console.info('[MSD v1] computeResolvedModel anchor keys=', Object.keys(cardModel.anchors || {}));
    }

    // 1. Profiles/base style assembly
    const baseOverlays = perfTime('profiles.assemble', () =>
      cardModel.overlaysBase.map(o => {
        const { style, sources } = assembleOverlayBaseStyle(o, runtimeActiveProfiles, profileIndex);
        return {
          id: o.id,
            type: o.type,
          style,
          finalStyle: { ...style },
          _styleSources: sources,
          _raw: o.raw
        };
      })
    );

    // 2. Rules (pass inline getEntity closure to avoid undefined)
    const ruleResult = rulesEngine.evaluateDirty({
      getEntity: id => entityRuntime.getEntity(id)
    });

    // 3. Profiles add/remove (affects next cycle)
    if (ruleResult.profilesAdd?.length || ruleResult.profilesRemove?.length) {
      const set = new Set(runtimeActiveProfiles);
      ruleResult.profilesAdd.forEach(p => set.add(p));
      ruleResult.profilesRemove.forEach(p => set.delete(p));
      runtimeActiveProfiles = Array.from(set);
    }

    // 4. Apply overlay patches
    const overlaysWithPatches = perfTime('styles.patch', () =>
      applyOverlayPatches(baseOverlays, ruleResult.overlayPatches)
    );

    // 5. value_map substitutions
    perfTime('value_map.subst', () =>
      resolveValueMaps(overlaysWithPatches, {
        getEntity: id => entityRuntime.getEntity(id)
      })
    );

    // 6. Animations (desired sets)
    const desiredAnimations = resolveDesiredAnimations(overlaysWithPatches, animationIndex, ruleResult.animations);
    const animDiff = animRegistry.diffApply(desiredAnimations);
    const desiredTimelines = resolveDesiredTimelines(timelineDefs);
    const tlDiff = animRegistry.diffApplyTimelines(desiredTimelines);

    // 7. Assign animation hash to overlays
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
    // NEW: update router with overlays for obstacle index (M5.2)
    try { router.setOverlays && router.setOverlays(resolved.overlays); } catch(_) {}
    _resolvedModelRef = resolved;        // NEW: track latest
    return resolved;
  }

  function reRender() {
    resolvedModel = computeResolvedModel();
    renderer.render(resolvedModel);
  }

  // Initial compute + render
  resolvedModel = computeResolvedModel();
  renderer.render(resolvedModel);

  // Public ingestion helpers
  function ingestHass(hass) {
    if (!hass) return;
    if (!hass.states) {
      // Light warning once per session if states missing
      if (!ingestHass._warned) {
        console.warn('[MSD v1] ingestHass called without hass.states');
        ingestHass._warned = true;
      }
      return;
    }
    entityRuntime.ingestHassStates(hass.states);
  }

  function updateEntities(map) {
    if (!map || typeof map !== 'object') return;
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
    merged: mergedConfig,          // CHANGED (was undefined 'merged')
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
    getResolvedModel: () => _resolvedModelRef,          // ensure accessor uses ref
    setAnchor(id, pt) {                                  // NEW
      if (!id || !Array.isArray(pt) || pt.length !== 2) return false;
      if (!cardModel.anchors) cardModel.anchors = {};
      cardModel.anchors[id] = [Number(pt[0]), Number(pt[1])];
      if (_resolvedModelRef?.anchors) _resolvedModelRef.anchors[id] = cardModel.anchors[id];
      router.invalidate && router.invalidate('*');
      try {
        if (this.renderer && _resolvedModelRef) {
          this.renderer._routerOverlaySync = false; // force overlays sync if renderer caches
          this.renderer.render(_resolvedModelRef);
        }
      } catch(_) {}
      return true;
    },
    getPerf: () => perfGetAll()          // NEW
  };

  // Debug exposure
  if (typeof window !== 'undefined') {
    const dbg = window.__msdDebug = window.__msdDebug || {};
    dbg.featureFlags = dbg.featureFlags || {};
    dbg.featureFlags.MSD_V1_ENABLE = MSD_V1_ENABLE;
    dbg.pipelineInstance = pipelineApi;
    dbg.pipeline = { merged: mergedConfig, cardModel, rulesEngine, router }; // CHANGED
    dbg._provenance = provenance; // CHANGED
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
    dbg.entities = {
      list: () => entityRuntime.listIds(),
      get: (id) => entityRuntime.getEntity(id),
      stats: () => entityRuntime.stats(),
      ingest: (statesObj) => entityRuntime.ingestHassStates(statesObj || {})
    };
    // NEW debug helpers for anchors
    dbg.anchors = {
      keys: () => Object.keys(cardModel.anchors || {}),
      dump: () => ({ ...cardModel.anchors }),
      repairFromMerged: () => pipelineApi.repairAnchorsFromMerged(),
      set: (id, x, y) => pipelineApi.setAnchor(id, [x, y])    // NEW
    };
    dbg.lines = dbg.lines || { markersEnabled: false, showMarkers(flag=true){ this.markersEnabled=!!flag; console.info('[MSD v1] line endpoint markers', this.markersEnabled?'ENABLED':'DISABLED'); } };
    dbg.lines.forceRedraw = () => {
      reRender();
      return true;
    };
    dbg.validation = {
      issues: () => mergedConfig.__issues
    };
    dbg.packs = {
      list: (type) => {
        if (!type) return {
          animations: mergedConfig.animations.length,
          overlays: mergedConfig.overlays.length,
          rules: mergedConfig.rules.length,
          profiles: mergedConfig.profiles.length,
          timelines: mergedConfig.timelines.length
        };
        return mergedConfig[type] || [];
      },
      get: (type,id) => (mergedConfig[type]||[]).find(i=>i.id===id),
      issues: () => mergedConfig.__issues
    };
    dbg.perf = () => perfGetAll();        // NEW simple accessor
  }
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
  });
}

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
  // Ensure feature flags visible even before initMsdPipeline runs
  window.__msdDebug.featureFlags = window.__msdDebug.featureFlags || {};
  window.__msdDebug.featureFlags.MSD_V1_ENABLE = MSD_V1_ENABLE;
})();

