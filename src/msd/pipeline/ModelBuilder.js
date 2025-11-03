import { applyOverlayPatches } from '../rules/RulesEngine.js';
import { resolveValueMaps } from '../valueMap/resolveValueMaps.js';
import { resolveDesiredAnimations } from '../animation/resolveAnimations.js';
import { resolveDesiredTimelines } from '../animation/resolveTimelines.js';
import { perfTime } from '../perf/PerfCounters.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { isHAEntity } from '../utils/HADomains.js';

export class ModelBuilder {
  constructor(mergedConfig, cardModel, systemsManager) {
    this.mergedConfig = mergedConfig;
    this.cardModel = cardModel;
    this.systems = systemsManager;

    this.animationIndex = new Map((mergedConfig.animations || []).map(a => [a.id, a]));
    this.timelineDefs = mergedConfig.timelines || [];

    this._resolvedModelRef = null;
  }

  computeResolvedModel() {
    // Anchor repair diagnostic
    this._ensureAnchors();

    // Assemble base overlays with profiles
    const baseOverlays = this._assembleBaseOverlays();

    // REMOVED: _subscribeOverlaysToDataSources (sparkline/ribbon/historybar specific)
    // this._subscribeOverlaysToDataSources(baseOverlays);

    // Subscribe overlays with triggers_update to data sources
    this._subscribeOverlaysToUpdates(baseOverlays);

    // Apply rules
    const ruleResult = this._applyRules();

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
      config: this.mergedConfig
    };

    // DEBUG: Check final overlay state before rendering
    const titleOverlay = resolved.overlays.find(o => o.id === 'title_overlay');
    if (titleOverlay) {
      cblcarsLog.debug('[ModelBuilder] 🏁 Final title_overlay state before rendering:', {
        id: titleOverlay.id,
        color: titleOverlay.style?.color,
        status_indicator: titleOverlay.style?.status_indicator,
        finalStyle: titleOverlay.finalStyle
      });
    }

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
        cblcarsLog.warn('[ModelBuilder] computeResolvedModel: anchors missing – repairing from merged.anchors');
        this.cardModel.anchors = { ...this.mergedConfig.anchors };
      } else {
        cblcarsLog.warn('[ModelBuilder] computeResolvedModel: anchors missing and no merged fallback available.');
      }
    }
  }


  _assembleBaseOverlays() {
    return perfTime('overlays.assemble', () => {
      return this.cardModel.overlaysBase.map(o => {
        // Start with overlay's own style (highest precedence)
        const baseStyle = o.style || {};

        // Resolve any theme token references in the style
        const resolvedStyle = this._resolveThemeTokensInStyle(baseStyle, o.type);

        // Preserve ALL properties from raw overlay config
        const resolvedOverlay = {
          id: o.id,
          type: o.type,
          style: resolvedStyle,
          finalStyle: { ...resolvedStyle },
          _raw: o.raw,
          anchor: o.raw?.anchor,
          attach_to: o.raw?.attach_to,
          anchor_side: o.raw?.anchor_side,
          attach_side: o.raw?.attach_side,
          anchor_gap: o.raw?.anchor_gap,
          attach_gap: o.raw?.attach_gap,
          position: o.raw?.position,
          size: o.raw?.size,
          rows: o.raw?.rows,
          columns: o.raw?.columns
        };

        // Preserve data source and routing properties
        if (o.raw?.source) resolvedOverlay.source = o.raw.source;
        if (o.raw?.route) resolvedOverlay.route = o.raw.route;
        if (o.raw?.data_source) resolvedOverlay.data_source = o.raw.data_source;

        // Preserve triggers_update for overlay subscriptions
        if (o.raw?.triggers_update) resolvedOverlay.triggers_update = o.raw.triggers_update;

        // Preserve action properties
        if (o.raw?.tap_action) resolvedOverlay.tap_action = o.raw.tap_action;
        if (o.raw?.hold_action) resolvedOverlay.hold_action = o.raw.hold_action;
        if (o.raw?.double_tap_action) resolvedOverlay.double_tap_action = o.raw.double_tap_action;

        // Preserve cells for status grids
        if (o.raw?.cells) resolvedOverlay.cells = o.raw.cells;

        // Preserve template reference
        if (o.raw?.template) resolvedOverlay.template = o.raw.template;

        // Preserve preset reference
        if (o.raw?.preset) resolvedOverlay.preset = o.raw.preset;

        return resolvedOverlay;
      });
    });
  }

  /**
   * Resolve theme token references in overlay style
   * @private
   */
  _resolveThemeTokensInStyle(style, overlayType) {
    if (!style || typeof style !== 'object') {
      return style;
    }

    const resolved = {};
    const themeManager = this.systems.themeManager;

    if (!themeManager || !themeManager.initialized) {
      // No theme system available, return style as-is
      return { ...style };
    }

    // Get component-scoped resolver
    const resolveToken = themeManager.forComponent(overlayType);

    // Recursively resolve token references in style values
    for (const [key, value] of Object.entries(style)) {
      if (typeof value === 'string' && value.startsWith('theme.')) {
        // This is a theme token reference: "theme.defaultSize"
        const tokenPath = value.substring(6); // Remove "theme." prefix
        resolved[key] = resolveToken(tokenPath, value);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively resolve nested objects
        resolved[key] = this._resolveThemeTokensInStyle(value, overlayType);
      } else {
        // Keep value as-is
        resolved[key] = value;
      }
    }

    return resolved;
  }




  // REMOVED METHOD: _subscribeOverlaysToDataSources
  // This method subscribed sparkline/ribbon/historybar overlays which are no longer supported.
  // Deleted in Phase 0 of architecture refactor.

  // REMOVED METHOD: _monitorPendingSubscriptions
  // This was only used by _subscribeOverlaysToDataSources.
  // Deleted in Phase 0 of architecture refactor.


  _applyRules() {
    cblcarsLog.debug('[ModelBuilder] 🔍 _applyRules() called');

    // FIXED: Always evaluate rules during render, not just when dirty
    // This ensures rule patches are generated even if rules weren't marked dirty externally
    this.systems.rulesEngine.markAllDirty();
    cblcarsLog.debug('[ModelBuilder] 📏 Marked all rules dirty');

    // Use DataSourceManager's getEntity for comprehensive entity resolution
    const getEntity = (entityId) => {
      // Use DataSourceManager's getEntity which handles:
      // - DataSource references with dot notation (temperature_enhanced.transformations.celsius)
      // - Regular Home Assistant entities
      // - Fallback to HASS states
      if (this.systems.dataSourceManager && this.systems.dataSourceManager.getEntity) {
        return this.systems.dataSourceManager.getEntity(entityId);
      }

      // Fallback to direct HASS access if no DataSourceManager (Phase 1: use new _hass property)
      if (this.systems._hass?.states?.[entityId]) {
        const hassState = this.systems._hass.states[entityId];
        return {
          state: hassState.state,
          attributes: hassState.attributes || {}
        };
      }

      return null;
    };

    const ruleResult = this.systems.rulesEngine.evaluateDirty({ getEntity });
    cblcarsLog.debug('[ModelBuilder] 📏 Rule evaluation result:', {
      overlayPatches: ruleResult.overlayPatches.length,
      patches: ruleResult.overlayPatches
    });

    return ruleResult;
  }

  _applyOverlayPatches(baseOverlays, ruleResult) {
    cblcarsLog.debug('[ModelBuilder] 🎨 _applyOverlayPatches() ENTRY:', {
      overlayCount: baseOverlays.length,
      patchCount: ruleResult.overlayPatches.length,
      patches: ruleResult.overlayPatches.map(p => ({
        overlayId: p.overlayId,
        ruleId: p.ruleId,
        changeKeys: Object.keys(p.changes || {})
      }))
    });

    const result = perfTime('styles.patch', () =>
      applyOverlayPatches(baseOverlays, ruleResult.overlayPatches)
    );

    cblcarsLog.debug('[ModelBuilder] 🎨 _applyOverlayPatches() COMPLETE - patches applied to overlays');

    // Log specific statusgrid overlays if patches were for statusgrid
    const statusgridPatches = ruleResult.overlayPatches.filter(p =>
      baseOverlays.find(o => o.id === p.overlayId && o.type === 'statusgrid')
    );

    if (statusgridPatches.length > 0) {
      cblcarsLog.info('[ModelBuilder] 🔲 STATUSGRID patches detected:', {
        count: statusgridPatches.length,
        patchedOverlayIds: statusgridPatches.map(p => p.overlayId)
      });

      statusgridPatches.forEach(patch => {
        const overlay = result.find(o => o.id === patch.overlayId);
        if (overlay) {
          cblcarsLog.info(`[ModelBuilder] 🔍 Statusgrid overlay "${patch.overlayId}" after patching:`, {
            id: overlay.id,
            type: overlay.type,
            hasButtons: !!overlay.buttons,
            buttonCount: overlay.buttons?.length || 0,
            patchChanges: patch.changes
          });
        }
      });
    }

    cblcarsLog.debug('[ModelBuilder] 🎨 Checking title_overlay:');
    const titleOverlay = result.find(o => o.id === 'title_overlay');
    if (titleOverlay) {
      cblcarsLog.debug('[ModelBuilder] 🎯 Title overlay after patching:', {
        id: titleOverlay.id,
        color: titleOverlay.style?.color,
        status_indicator: titleOverlay.style?.status_indicator
      });
    }

    return result;
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


  /**
   * Clean up overlay subscriptions
   * @public
   */
  destroy() {
    if (this._overlayUnsubscribers) {
      cblcarsLog.debug(`[ModelBuilder] Cleaning up ${this._overlayUnsubscribers.size} overlay subscriptions`);

      for (const [overlayId, unsubscribers] of this._overlayUnsubscribers) {
        unsubscribers.forEach(unsubscribe => {
          try {
            unsubscribe();
          } catch (error) {
            cblcarsLog.warn(`[ModelBuilder] Error unsubscribing overlay ${overlayId}:`, error);
          }
        });
      }

      this._overlayUnsubscribers.clear();
    }
  }

  /**
   * Set up subscriptions for overlays with triggers_update
   * @param {Array} overlays - Array of overlay configurations
   * @private
   */
  _subscribeOverlaysToUpdates(overlays) {
    overlays.forEach(overlay => {
      // Check for explicit triggers_update array
      if (!overlay.triggers_update || !Array.isArray(overlay.triggers_update)) {
        return;
      }

      cblcarsLog.debug(`[ModelBuilder] Setting up subscriptions for ${overlay.id}:`, overlay.triggers_update);

      overlay.triggers_update.forEach(ref => {
        // Use HADomains utility to distinguish HA entities from MSD datasources
        if (isHAEntity(ref)) {
          // HA entity - skip for now (handled by MsdTemplateEngine)
          cblcarsLog.debug(`[ModelBuilder] Skipping HA entity: ${ref} (handled by MsdTemplateEngine)`);
          return;
        }

        // MSD datasource - subscribe
        this._subscribeOverlayToDataSource(overlay.id, ref);
      });
    });
  }

  /**
   * Subscribe an overlay to a specific DataSource
   * @param {string} overlayId - ID of the overlay
   * @param {string} dataSourceRef - DataSource reference (e.g., 'temperature' or 'cpu.transformations.celsius')
   * @private
   */
  _subscribeOverlayToDataSource(overlayId, dataSourceRef) {
    try {
      const dataSourceManager = this.systems?.dataSourceManager;
      if (!dataSourceManager) {
        cblcarsLog.warn(`[ModelBuilder] DataSourceManager not available for overlay subscription: ${overlayId}`);
        return;
      }

      // Parse DataSource reference to get source name
      const sourceName = dataSourceRef.split('.')[0];
      const dataSource = dataSourceManager.getSource(sourceName);

      if (!dataSource) {
        cblcarsLog.warn(`[ModelBuilder] DataSource '${sourceName}' not found for overlay: ${overlayId}`);
        return;
      }

      // ✅ CRITICAL: Check if already subscribed
      if (!this._overlayUnsubscribers) {
        this._overlayUnsubscribers = new Map();
      }

      if (!this._overlayUnsubscribers.has(overlayId)) {
        this._overlayUnsubscribers.set(overlayId, []);
      }

      // Create subscription callback
      const callback = (data) => {
        cblcarsLog.debug(`[ModelBuilder] 📊 Overlay ${overlayId} received DataSource update from ${sourceName}`);

        // Notify AdvancedRenderer to update the overlay
        if (this.systems.renderer && this.systems.renderer.updateOverlayData) {
          this.systems.renderer.updateOverlayData(overlayId, data);
        } else {
          cblcarsLog.warn(`[ModelBuilder] Renderer updateOverlayData not available for ${overlayId}`);
        }
      };

      // Subscribe to the DataSource

      const unsubscribe = dataSource.subscribe(callback);
      this._overlayUnsubscribers.get(overlayId).push(unsubscribe);

      cblcarsLog.debug(`[ModelBuilder] ✅ Subscribed overlay ${overlayId} to DataSource ${sourceName}`);

    } catch (error) {
      cblcarsLog.error(`[ModelBuilder] Failed to subscribe overlay ${overlayId} to DataSource ${dataSourceRef}:`, error);
    }
  }
}
