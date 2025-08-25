import { globalProfileResolver } from '../profile/ProfileResolver.js';
import { applyOverlayPatches } from '../rules/RulesEngine.js';
import { resolveValueMaps } from '../valueMap/resolveValueMaps.js';
import { resolveDesiredAnimations } from '../animation/resolveAnimations.js';
import { resolveDesiredTimelines } from '../animation/resolveTimelines.js';
import { perfTime } from '../perf/PerfCounters.js';

export class ModelBuilder {
  constructor(mergedConfig, cardModel, systemsManager) {
    this.mergedConfig = mergedConfig;
    this.cardModel = cardModel;
    this.systems = systemsManager;

    // Replace profile index building with ProfileResolver
    globalProfileResolver.loadProfiles(mergedConfig.profiles || []);

    this.animationIndex = new Map((mergedConfig.animations || []).map(a => [a.id, a]));
    this.timelineDefs = mergedConfig.timelines || [];
    this.runtimeActiveProfiles = Array.isArray(mergedConfig.active_profiles)
      ? mergedConfig.active_profiles.slice()
      : [];
    this._resolvedModelRef = null;
  }

  computeResolvedModel() {
    // Anchor repair diagnostic
    this._ensureAnchors();

    // Assemble base overlays with profiles
    const baseOverlays = this._assembleBaseOverlays();

    // Subscribe overlays to data sources
    this._subscribeOverlaysToDataSources(baseOverlays);

    // Apply rules
    const ruleResult = this._applyRules();

    // Handle profile changes from rules
    this._updateActiveProfiles(ruleResult);

    // Apply overlay patches
    const overlaysWithPatches = this._applyOverlayPatches(baseOverlays, ruleResult);

    // Value map substitutions
    this._resolveValueMaps(overlaysWithPatches);

    // Process animations
    const { activeAnimations, animDiff, tlDiff } = this._processAnimations(overlaysWithPatches, ruleResult);

    // Build final resolved model
    const resolved = {
      viewBox: this.cardModel.viewBox,
      anchors: { ...this.cardModel.anchors },
      overlays: overlaysWithPatches,
      animations: animDiff.active,
      timelines: tlDiff.active,
      active_profiles: this.runtimeActiveProfiles.slice()
    };

    // Update router
    try {
      this.systems.router.setOverlays && this.systems.router.setOverlays(resolved.overlays);
    } catch(_) {}

    this._resolvedModelRef = resolved;
    return resolved;
  }

  getResolvedModel() {
    return this._resolvedModelRef;
  }

  _ensureAnchors() {
    if (!this.cardModel.anchors || Object.keys(this.cardModel.anchors).length === 0) {
      if (this.mergedConfig.anchors && Object.keys(this.mergedConfig.anchors).length) {
        console.warn('[MSD v1] computeResolvedModel: anchors missing – repairing from merged.anchors');
        this.cardModel.anchors = { ...this.mergedConfig.anchors };
      } else {
        console.warn('[MSD v1] computeResolvedModel: anchors missing and no merged fallback available.');
      }
    }
  }

  _assembleBaseOverlays() {
    return perfTime('profiles.assemble', () => {
      // Set active profiles before resolving
      globalProfileResolver.setActiveProfiles(this.runtimeActiveProfiles);

      return this.cardModel.overlaysBase.map(o => {
        // Replace assembleOverlayBaseStyle with ProfileResolver
        const style = globalProfileResolver.resolveOverlayStyle(o);

        // Get provenance from resolved style (if needed for debugging)
        const sources = style.__styleProvenance ?
          Object.entries(style.__styleProvenance).map(([prop, prov]) => ({
            kind: prov.source,
            id: prov.sourceId
          })) : [];

        // Preserve ALL properties from raw overlay config
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

        // Preserve data source and routing properties
        if (o.raw?.source) {
          resolvedOverlay.source = o.raw.source;
        }

        if (o.raw?.route) {
          resolvedOverlay.route = o.raw.route;
        }

        return resolvedOverlay;
      });
    });
  }

  _subscribeOverlaysToDataSources(baseOverlays) {
    if (this.systems.dataSourceManager && baseOverlays) {
      let subscriptionCount = 0;
      baseOverlays.forEach(overlay => {
        if ((overlay.type === 'sparkline' || overlay.type === 'ribbon') && overlay.source) {
          try {
            this.systems.dataSourceManager.subscribeOverlay(overlay, (overlay, updateData) => {
              console.log('[MSD v1] 📊 Data update for overlay', overlay.id, 'value:', updateData.sourceData?.v);

              // Update the renderer with real data
              if (this.systems.renderer && this.systems.renderer.updateOverlayData) {
                this.systems.renderer.updateOverlayData(overlay.id, updateData.sourceData);
              }
            });
            subscriptionCount++;
            console.log('[MSD v1] ✅ Subscribed overlay', overlay.id, 'to data source', overlay.source);
          } catch (error) {
            console.warn('[MSD v1] ⚠️ Failed to subscribe overlay', overlay.id, 'to source', overlay.source, ':', error.message);
          }
        }
      });

      if (subscriptionCount > 0) {
        console.log('[MSD v1] ✅ Established', subscriptionCount, 'overlay data subscriptions');
      }
    }
  }

  _applyRules() {
    return this.systems.rulesEngine.evaluateDirty({
      getEntity: id => this.systems.entityRuntime.getEntity(id)
    });
  }

  _updateActiveProfiles(ruleResult) {
    if (ruleResult.profilesAdd?.length || ruleResult.profilesRemove?.length) {
      const set = new Set(this.runtimeActiveProfiles);
      ruleResult.profilesAdd.forEach(p => set.add(p));
      ruleResult.profilesRemove.forEach(p => set.delete(p));
      this.runtimeActiveProfiles = Array.from(set);

      // Update ProfileResolver with new active profiles
      globalProfileResolver.setActiveProfiles(this.runtimeActiveProfiles);
    }
  }

  _applyOverlayPatches(baseOverlays, ruleResult) {
    return perfTime('styles.patch', () =>
      applyOverlayPatches(baseOverlays, ruleResult.overlayPatches)
    );
  }

  _resolveValueMaps(overlaysWithPatches) {
    perfTime('value_map.subst', () =>
      resolveValueMaps(overlaysWithPatches, {
        getEntity: id => this.systems.entityRuntime.getEntity(id)
      })
    );
  }

  _processAnimations(overlaysWithPatches, ruleResult) {
    const desiredAnimations = resolveDesiredAnimations(overlaysWithPatches, this.animationIndex, ruleResult.animations);
    const desiredTimelines = resolveDesiredTimelines(this.timelineDefs);
    const activeAnimations = [];

    desiredAnimations.forEach(animDef => {
      const instance = this.systems.animRegistry.getOrCreateInstance(animDef.definition, animDef.targets);
      if (instance) {
        activeAnimations.push({
          id: animDef.id,
          instance,
          hash: this.systems.animRegistry.computeInstanceHash(animDef.definition)
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

    return { activeAnimations, animDiff, tlDiff };
  }
}
