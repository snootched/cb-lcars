import { applyOverlayPatches } from '../rules/RulesEngine.js';
import { resolveValueMaps } from '../valueMap/resolveValueMaps.js';
import { resolveDesiredAnimations } from '../animation/resolveAnimations.js';
import { resolveDesiredTimelines } from '../animation/resolveTimelines.js';
import { perfTime } from '../perf/PerfCounters.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

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

    // Subscribe text overlays to data sources
    this._subscribeTextOverlaysToDataSources(baseOverlays);

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
   * Set up DataSource subscriptions for text overlays that use template strings
   * @param {Array} overlays - Array of overlay configurations
   * @private
   */
  _subscribeTextOverlaysToDataSources(overlays) {
    overlays.forEach(overlay => {
      if (overlay.type === 'text') {
        // Check if text content contains DataSource references
        const textContent = overlay.text || overlay.content || overlay.finalStyle?.value || '';
        const dataSourceRef = overlay.data_source || overlay._raw?.data_source || overlay.finalStyle?.data_source;

        // Extract DataSource references from template strings like {temperature_enhanced.transformations.celsius}
        const templateRefs = this._extractDataSourceReferences(textContent);

        // Subscribe to direct DataSource references
        if (dataSourceRef) {
          this._subscribeTextOverlayToDataSource(overlay.id, dataSourceRef);
        }

        // Subscribe to template string DataSource references
        templateRefs.forEach(ref => {
          this._subscribeTextOverlayToDataSource(overlay.id, ref);
        });
      }
    });
  }

  /**
   * Subscribe a text overlay to a specific DataSource
   * @param {string} overlayId - ID of the text overlay
   * @param {string} dataSourceRef - DataSource reference (e.g., 'temperature_enhanced')
   * @private
   */
  _subscribeTextOverlayToDataSource(overlayId, dataSourceRef) {
    try {
      const dataSourceManager = this.systems?.dataSourceManager;
      if (!dataSourceManager) {
        cblcarsLog.warn(`[ModelBuilder] DataSourceManager not available for text overlay subscription: ${overlayId}`);
        return;
      }

      // Parse DataSource reference to get source name
      const sourceName = dataSourceRef.split('.')[0];
      const dataSource = dataSourceManager.getSource(sourceName);

      if (!dataSource) {
        cblcarsLog.warn(`[ModelBuilder] DataSource '${sourceName}' not found for text overlay: ${overlayId}`);
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
        cblcarsLog.debug(`[ModelBuilder] 📊 Text overlay ${overlayId} received DataSource update from ${sourceName}`);

        // Notify AdvancedRenderer to update the text overlay
        if (this.systems.renderer && this.systems.renderer.updateOverlayData) {
          this.systems.renderer.updateOverlayData(overlayId, data);
        } else {
          cblcarsLog.warn(`[ModelBuilder] Renderer updateOverlayData not available for ${overlayId}`);
        }
      };

      // Subscribe to the DataSource

      const unsubscribe = dataSource.subscribe(callback);
      this._overlayUnsubscribers.get(overlayId).push(unsubscribe);

      //dataSource.subscribe(overlayId, callback);

      cblcarsLog.debug(`[ModelBuilder] ✅ Subscribed text overlay ${overlayId} to DataSource ${sourceName}`);

    } catch (error) {
      cblcarsLog.error(`[ModelBuilder] Failed to subscribe text overlay ${overlayId} to DataSource ${dataSourceRef}:`, error);
    }
  }

  /**
   * Extract DataSource references from template strings
   * @param {string} content - Text content that may contain template strings
   * @returns {Array<string>} Array of DataSource references
   * @private
   */
  _extractDataSourceReferences(content) {
    if (!content || typeof content !== 'string') {
      return [];
    }

    const references = [];
    const regex = /\{([^}:]+)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const ref = match[1].trim();

      // Check if it's a DataSource reference (not a HA entity)
      if (ref.includes('.')) {
        const parts = ref.split('.');
        const sourceName = parts[0];

        // Check if this looks like a DataSource reference
        // (has transformations, aggregations, or is a known source)
        if (parts.includes('transformations') ||
            parts.includes('aggregations') ||
            this.systems?.dataSourceManager?.getSource(sourceName)) {
          references.push(sourceName);
        }
      }
    }

    // Return unique references
    return [...new Set(references)];
  }
}
