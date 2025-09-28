import { globalProfileResolver } from '../profile/ProfileResolver.js';
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
      config: this.mergedConfig,
      active_profiles: this.runtimeActiveProfiles.slice()
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
          anchor_side: o.raw?.anchor_side,
          attach_side: o.raw?.attach_side,
          anchor_gap: o.raw?.anchor_gap,
          attach_gap: o.raw?.attach_gap,
          position: o.raw?.position,
          size: o.raw?.size,
        };

        // Preserve data source and routing properties
        if (o.raw?.source) {
          resolvedOverlay.source = o.raw.source;
        }

        if (o.raw?.route) {
          resolvedOverlay.route = o.raw.route;
        }

        // CRITICAL: Preserve action properties for ActionHelpers
        if (o.raw?.tap_action) {
          resolvedOverlay.tap_action = o.raw.tap_action;
        }

        if (o.raw?.hold_action) {
          resolvedOverlay.hold_action = o.raw.hold_action;
        }

        if (o.raw?.double_tap_action) {
          resolvedOverlay.double_tap_action = o.raw.double_tap_action;
        }

        // Preserve cells for status grids
        if (o.raw?.cells) {
          resolvedOverlay.cells = o.raw.cells;
        }

        return resolvedOverlay;
      });
    });
  }

  _subscribeOverlaysToDataSources(baseOverlays) {
    if (!this.systems.dataSourceManager || !baseOverlays) {
      cblcarsLog.debug('[ModelBuilder] Skipping overlay subscriptions - no DataSourceManager or overlays');
      return;
    }

    let subscriptionCount = 0;
    let pendingSubscriptions = 0;

    baseOverlays.forEach(overlay => {
      if ((overlay.type === 'sparkline' || overlay.type === 'ribbon') && overlay.source) {
        try {
          // Check if data source exists and is ready
          const dataSource = this.systems.dataSourceManager.getSource(overlay.source);
          if (!dataSource) {
            cblcarsLog.warn(`[ModelBuilder] Data source '${overlay.source}' not found for overlay ${overlay.id}`);
            return;
          }

          // Check data source readiness
          const currentData = dataSource.getCurrentData();
          const isReady = currentData && (currentData.bufferSize > 0 || currentData.v !== undefined);

          cblcarsLog.debug(`[ModelBuilder] Subscribing overlay ${overlay.id} to source ${overlay.source}:`, {
            sourceReady: isReady,
            bufferSize: currentData?.bufferSize || 0,
            hasValue: currentData?.v !== undefined
          });

          // Subscribe with enhanced callback
          const unsubscribe = this.systems.dataSourceManager.subscribeOverlay(overlay, (overlayConfig, updateData) => {
            cblcarsLog.debug(`[ModelBuilder] 📊 Data update for overlay ${overlayConfig.id}:`, {
              value: updateData.v,
              bufferSize: updateData.buffer?.size?.() || 0,
              hasHistoricalData: !!(updateData.historicalData?.length),
              sourceReady: true
            });

            // Update the renderer with real data
            if (this.systems.renderer && this.systems.renderer.updateOverlayData) {
              try {
                this.systems.renderer.updateOverlayData(overlayConfig.id, updateData);
              } catch (error) {
                cblcarsLog.error(`[ModelBuilder] Error updating overlay ${overlayConfig.id}:`, error);
              }
            } else {
              cblcarsLog.warn(`[ModelBuilder] Renderer not available for overlay update: ${overlayConfig.id}`);
            }
          });

          if (unsubscribe) {
            subscriptionCount++;
            if (isReady) {
              cblcarsLog.debug(`[ModelBuilder] ✅ Subscribed overlay ${overlay.id} to ready source ${overlay.source}`);
            } else {
              pendingSubscriptions++;
              cblcarsLog.debug(`[ModelBuilder] ⏳ Subscribed overlay ${overlay.id} to pending source ${overlay.source}`);
            }

            // Store unsubscribe function for cleanup
            if (!this._overlayUnsubscribers) {
              this._overlayUnsubscribers = new Map();
            }
            if (!this._overlayUnsubscribers.has(overlay.id)) {
              this._overlayUnsubscribers.set(overlay.id, []);
            }
            this._overlayUnsubscribers.get(overlay.id).push(unsubscribe);
          }

        } catch (error) {
          cblcarsLog.warn(`[ModelBuilder] ⚠️ Failed to subscribe overlay ${overlay.id} to source ${overlay.source}:`, error.message);
        }
      }
    });

    if (subscriptionCount > 0) {
      cblcarsLog.debug(`[ModelBuilder] ✅ Established ${subscriptionCount} overlay data subscriptions (${pendingSubscriptions} pending data)`);
    }

    // Monitor pending subscriptions and log when they become ready
    if (pendingSubscriptions > 0) {
      this._monitorPendingSubscriptions(baseOverlays, pendingSubscriptions);
    }

    // Subscribe to text overlays data sources
    this._subscribeTextOverlaysToDataSources(baseOverlays);
  }




  /**
   * Monitor pending subscriptions and report when data becomes available
   * @private
   * @param {Array} baseOverlays - Array of overlay configurations
   * @param {number} pendingCount - Initial count of pending subscriptions
   */
  _monitorPendingSubscriptions(baseOverlays, pendingCount) {
    let checkCount = 0;
    const maxChecks = 50; // Maximum number of checks (5 seconds with 100ms intervals)

    const checkInterval = setInterval(() => {
      checkCount++;
      let stillPending = 0;

      baseOverlays.forEach(overlay => {
        if ((overlay.type === 'sparkline' || overlay.type === 'ribbon') && overlay.source) {
          const dataSource = this.systems.dataSourceManager.getSource(overlay.source);
          if (dataSource) {
            const currentData = dataSource.getCurrentData();
            const isReady = currentData && (currentData.bufferSize > 0 || currentData.v !== undefined);
            if (!isReady) {
              stillPending++;
            }
          }
        }
      });

      if (stillPending === 0) {
        cblcarsLog.debug(`[ModelBuilder] 🎉 All overlay data sources are now ready (checked ${checkCount} times)`);
        clearInterval(checkInterval);
      } else if (checkCount >= maxChecks) {
        cblcarsLog.warn(`[ModelBuilder] ⏰ Timeout waiting for ${stillPending} data sources to become ready`);
        clearInterval(checkInterval);
      } else if (checkCount % 10 === 0) {
        // Log progress every second (10 * 100ms)
        cblcarsLog.debug(`[ModelBuilder] ⏳ Still waiting for ${stillPending} data sources (${checkCount * 100}ms elapsed)`);
      }
    }, 100); // Check every 100ms
  }




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

      // Fallback to direct HASS access if no DataSourceManager
      if (this.systems._currentHass?.states?.[entityId]) {
        const hassState = this.systems._currentHass.states[entityId];
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
  }  _updateActiveProfiles(ruleResult) {
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
    cblcarsLog.debug('[ModelBuilder] 🎨 _applyOverlayPatches() called with:', {
      overlayCount: baseOverlays.length,
      patchCount: ruleResult.overlayPatches.length,
      patches: ruleResult.overlayPatches
    });

    const result = perfTime('styles.patch', () =>
      applyOverlayPatches(baseOverlays, ruleResult.overlayPatches)
    );

    cblcarsLog.debug('[ModelBuilder] 🎨 Overlay patches applied. Checking title_overlay:');
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

      // Create subscription callback
      const callback = (data) => {
        cblcarsLog.debug(`[ModelBuilder] 📊 Text overlay ${overlayId} received DataSource update from ${sourceName}`);

        // Notify AdvancedRenderer to update the text overlay
        if (this.systems.renderer && this.systems.renderer.updateOverlayData) {
          this.systems.renderer.updateOverlayData(overlayId, data);
        }
      };

      // Subscribe to the DataSource
      dataSource.subscribe(overlayId, callback);

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
    const templatePattern = /\{([^}]+)\}/g;
    let match;

    while ((match = templatePattern.exec(content)) !== null) {
      const reference = match[1].split(':')[0].trim(); // Remove formatting specs

      // Only include if it looks like a DataSource reference (contains dots or is a simple identifier)
      if (reference.includes('.') || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(reference)) {
        const sourceName = reference.split('.')[0];
        if (!references.includes(sourceName)) {
          references.push(sourceName);
        }
      }
    }

    return references;
  }
}
