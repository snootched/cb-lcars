/**
 * [RulesEngine] Rules evaluation system - processes rules with DataSource integration and performance tracing
 * 🧠 Features dependency tracking, conditional evaluation, overlay patching, and comprehensive rule tracing
 */

import { perfTime, perfCount } from '../util/performance.js';
import { globalTraceBuffer } from './RuleTraceBuffer.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { ApexChartsOverlayRenderer } from '../renderer/ApexChartsOverlayRenderer.js';

export class RulesEngine {
  constructor(rules = [], dataSourceManager = null) {
    this.rules = Array.isArray(rules) ? rules : [];
    this.rulesById = new Map();
    this.dependencyIndex = null;
    this.dirtyRules = new Set();
    this.lastEvaluation = new Map(); // ruleId -> evaluation result
    this.traceBuffer = globalTraceBuffer;
    this.stopProcessing = new Map(); // overlayId -> Set of stopped rule priorities

    // NEW: DataSource integration
    this.dataSourceManager = dataSourceManager;

    // Performance tracking
    this.evalCounts = {
      total: 0,
      dirty: 0,
      matched: 0,
      skipped: 0
    };

    // NEW: HASS subscription management
    this.hassUnsubscribe = null;
    this._reEvaluationCallback = null;
    this._hassEntities = new Set(); // Cached entity list for performance
    this._freshStateCache = new Map(); // Cache for fresh states from events (entityId -> state object)

    this.buildRulesIndex();
    this.buildDependencyIndex();
    this.markAllDirty(); // Initial state
  }

  buildRulesIndex() {
    this.rulesById.clear();
    this.rules.forEach(rule => {
      if (rule.id) {
        this.rulesById.set(rule.id, rule);
      }
    });
  }

  buildDependencyIndex() {
    const entityToRules = new Map();
    const ruleToEntities = new Map();

    this.rules.forEach(rule => {
      const entities = this.extractEntityReferences(rule);
      ruleToEntities.set(rule.id, entities);

      entities.forEach(entityId => {
        if (!entityToRules.has(entityId)) {
          entityToRules.set(entityId, new Set());
        }
        entityToRules.get(entityId).add(rule.id);
      });
    });

    this.dependencyIndex = { entityToRules, ruleToEntities };

    // Update cached entity list for performance
    if (this.hassUnsubscribe) {
      const ruleEntities = Array.from(this.dependencyIndex?.entityToRules.keys() || [])
        .filter(entityId => !entityId.includes('.'));
      this._hassEntities = new Set(ruleEntities);

      cblcarsLog.debug(`[RulesEngine] Updated monitored entities: ${ruleEntities.length} entities`);
    }

    // Debug exposure
    try {
      const debugNamespace = (typeof window !== 'undefined') ? window : global;
      if (debugNamespace.__msdDebug) {
        debugNamespace.__msdDebug.rulesDeps = {
          entityToRules: Object.fromEntries(entityToRules),
          ruleToEntities: Object.fromEntries(ruleToEntities),
          totalEntities: entityToRules.size,
          totalRules: this.rules.length
        };
      }
    } catch (e) {}
  }

  extractEntityReferences(rule) {
    const entities = new Set();

    if (!rule.when) return Array.from(entities);

    // Extract from all/any conditions
    const conditions = [
      ...(rule.when.all || []),
      ...(rule.when.any || [])
    ];

    conditions.forEach(condition => {
      // Direct entity reference
      if (condition.entity) {
        // FIXED: Better DataSource detection and filtering
        if (condition.entity.includes('.')) {
          // This looks like a DataSource reference (e.g., "temperature_enhanced.transformations.celsius")
          const sourceName = condition.entity.split('.')[0];

          // Check if this is actually a DataSource by consulting the DataSourceManager
          if (this.dataSourceManager && this.dataSourceManager.getSource(sourceName)) {
            cblcarsLog.debug(`[RulesEngine] Skipping DataSource reference in rule monitoring: ${condition.entity}`);
            // Don't add DataSource references to HASS entity monitoring
            // The DataSourceManager already handles these entities via its own subscriptions
            return;
          } else {
            // Not a DataSource, might be an entity with attribute reference (e.g., "sensor.temp.state")
            // Extract just the entity ID part
            const entityId = condition.entity.split('.')[0] + '.' + condition.entity.split('.')[1];
            if (entityId.includes('.') && entityId.split('.').length === 2) {
              entities.add(entityId);
              cblcarsLog.debug(`[RulesEngine] Added entity with attribute to monitoring: ${entityId} (from ${condition.entity})`);
            }
          }
        } else {
          // Regular Home Assistant entity (no dots)
          entities.add(condition.entity);
          cblcarsLog.debug(`[RulesEngine] Added regular entity to monitoring: ${condition.entity}`);
        }
      }

      // Entity attribute reference (e.g., "sensor.temp.state")
      if (condition.entity_attr) {
        const entityId = condition.entity_attr.split('.')[0];
        entities.add(entityId);
      }

      // Map range condition
      if (condition.map_range_cond?.entity) {
        entities.add(condition.map_range_cond.entity);
      }

      // Value map references in rule conditions
      if (condition.value_map?.entity) {
        entities.add(condition.value_map.entity);
      }
    });

    return Array.from(entities);
  }

  markEntitiesDirty(changedEntityIds) {
    if (!Array.isArray(changedEntityIds)) {
      changedEntityIds = [changedEntityIds];
    }

    let affectedRules = 0;

    changedEntityIds.forEach(entityId => {
      // Direct entity/DataSource rule matches
      const rules = this.dependencyIndex.entityToRules.get(entityId);
      if (rules) {
        rules.forEach(ruleId => {
          if (!this.dirtyRules.has(ruleId)) {
            this.dirtyRules.add(ruleId);
            affectedRules++;
          }
        });
      }

      // Handle DataSource change propagation
      // If a DataSource changes, mark rules that depend on its transformations/aggregations
      if (this.dataSourceManager?.getSource(entityId)) {
        // Find rules that depend on this DataSource's transformations/aggregations
        for (const [fullRef, ruleSet] of this.dependencyIndex.entityToRules) {
          if (fullRef.startsWith(`${entityId}.`)) {
            ruleSet.forEach(ruleId => {
              if (!this.dirtyRules.has(ruleId)) {
                this.dirtyRules.add(ruleId);
                affectedRules++;
              }
            });
          }
        }
      }
    });

    perfCount('rules.dirty.entities', changedEntityIds.length);
    perfCount('rules.dirty.affected', affectedRules);

    return affectedRules;
  }

  markAllDirty() {
    this.dirtyRules.clear();
    this.rules.forEach(rule => {
      if (rule.id) {
        this.dirtyRules.add(rule.id);
      }
    });
    perfCount('rules.dirty.all', this.dirtyRules.size);
  }

  evaluateDirty(context = {}) {
    return perfTime('rules.evaluate', () => {
      let { getEntity } = context;

      // ENHANCED: Always prioritize original HASS states for rule evaluation
      // regardless of the context or provided getEntity function
      if (this.dataSourceManager || this.systemsManager) {
        const originalGetEntity = getEntity;

        getEntity = (entityId) => {
          cblcarsLog.trace(`[RulesEngine] getEntity called for: ${entityId}`);

          // PRIORITY 0: Check fresh state cache from events (most recent data)
          if (this._freshStateCache.has(entityId)) {
            const freshState = this._freshStateCache.get(entityId);
            cblcarsLog.trace(`[RulesEngine] Using FRESH cached state for ${entityId}: ${freshState.state}`);
            return freshState;
          }

          // PRIORITY 1: Try to get HASS state from SystemsManager
          if (this.systemsManager) {
            const hass = this.systemsManager.getHass();
            if (hass && hass.states && hass.states[entityId]) {
              const state = hass.states[entityId].state;
              cblcarsLog.trace(`[RulesEngine] Found HASS state for ${entityId}: ${state}`);

              return {
                entity_id: entityId,
                state: state,
                attributes: hass.states[entityId].attributes || {},
                last_changed: hass.states[entityId].last_changed,
                last_updated: hass.states[entityId].last_updated
              };
            }
          }

          // PRIORITY 2: Check if this is a DataSource reference (contains dots)
          if (entityId.includes('.') && this.dataSourceManager) {
            const value = this.resolveDataSourceValue(entityId);
            if (value !== null) {
              cblcarsLog.trace(`[RulesEngine] Found DataSource reference value for ${entityId}: ${value}`);
              return {
                entity_id: entityId,
                state: String(value),
                attributes: {}
              };
            }
          }

          // PRIORITY 3: Try auto-created template DataSource with original entity preservation
          const templateDataSourceName = `template_${entityId.replace(/\./g, '_')}`;
          if (this.dataSourceManager) {
            const templateDataSource = this.dataSourceManager.getSource(templateDataSourceName);
            if (templateDataSource) {
              const currentData = templateDataSource.getCurrentData();
              if (currentData && currentData.entity && currentData.entity.state !== undefined) {
                const originalState = currentData.entity.state;
                cblcarsLog.trace(`[RulesEngine] Found auto-DataSource original state for ${entityId}: ${originalState}`);

                return {
                  entity_id: entityId,
                  state: originalState,
                  attributes: currentData.entity.attributes || {},
                  last_changed: currentData.entity.last_changed,
                  last_updated: currentData.entity.last_updated
                };
              }
            }
          }

          // PRIORITY 4: Fall back to provided getEntity function (debug: type coercion may occur)
          if (originalGetEntity) {
            const entity = originalGetEntity(entityId);
            if (entity) {
              cblcarsLog.debug(`[RulesEngine] Using fallback getEntity for ${entityId} - state may be converted: ${entity.state}`);
              return entity;
            }
          }

          // PRIORITY 5: Try DataSourceManager's getEntity method as last resort (debug: type coercion may occur)
          if (this.dataSourceManager && this.dataSourceManager.getEntity) {
            const entity = this.dataSourceManager.getEntity(entityId);
            if (entity) {
              cblcarsLog.debug(`[RulesEngine] Using DataSourceManager getEntity for ${entityId} - state may be converted: ${entity.state}`);
              return entity;
            }
          }

          cblcarsLog.warn(`[RulesEngine] No entity data found for ${entityId}`);
          return null;
        };
      }

      if (!getEntity || typeof getEntity !== 'function') {
        cblcarsLog.warn('[RulesEngine] ⚠️ evaluateDirty called without getEntity function and no DataSourceManager available');
        return this.createEmptyResult();
      }

      const totalDirty = this.dirtyRules.size;
      const results = [];
      const processedRules = new Set();

      // Sort dirty rules by priority (higher first)
      const dirtyRulesArray = Array.from(this.dirtyRules)
        .map(ruleId => this.rulesById.get(ruleId))
        .filter(rule => rule)
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));

      dirtyRulesArray.forEach(rule => {
        if (processedRules.has(rule.id)) return;

        const result = this.evaluateRule(rule, getEntity);
        processedRules.add(rule.id);

        // Cache evaluation result
        this.lastEvaluation.set(rule.id, {
          matched: result.matched,
          timestamp: Date.now(),
          conditions: result.conditions
        });

        if (result.matched) {
          results.push(result);
          this.evalCounts.matched++;
        }

        // Remove from dirty set
        this.dirtyRules.delete(rule.id);
      });

      // Performance tracking
      this.evalCounts.total += totalDirty;
      this.evalCounts.dirty += totalDirty;
      this.evalCounts.skipped += (this.rules.length - totalDirty);

      perfCount('rules.eval.total', totalDirty);
      perfCount('rules.eval.matched', results.length);
      perfCount('rules.eval.skipped', this.rules.length - totalDirty);

      return this.aggregateResults(results);
    });
  }

  /**
   * Ingest fresh HASS state and trigger rule re-evaluation
   * Called by SystemsManager when HASS updates
   * @param {Object} hass - Fresh Home Assistant state object
   */
  ingestHass(hass) {
    if (!hass || !hass.states) {
      cblcarsLog.warn('[RulesEngine] ingestHass: Invalid HASS provided');
      return;
    }

    // Mark all rules dirty since any entity could have changed
    this.markAllDirty();

    // Trigger re-evaluation callback if registered
    if (this._reEvaluationCallback) {
      try {
        this._reEvaluationCallback();
      } catch (error) {
        cblcarsLog.error('[RulesEngine] Error in re-evaluation callback:', error);
      }
    }
  }

  evaluateRule(rule, getEntity) {
    const startTime = performance.now();

    try {
      const conditions = this.evaluateConditions(rule.when, getEntity);
      const matched = this.determineMatch(rule.when, conditions);
      const evaluationTime = performance.now() - startTime;

      const result = {
        ruleId: rule.id,
        priority: rule.priority || 0,
        matched,
        conditions,
        rule,
        evaluationTime
      };

      // Add trace entry
      this.traceBuffer.addTrace(
        rule.id,
        matched,
        conditions,
        evaluationTime,
        {
          priority: rule.priority || 0,
          conditionCount: this.countConditions(rule.when),
          entityRefs: this.dependencyIndex?.ruleToEntities.get(rule.id) || []
        }
      );

      if (matched && rule.apply) {
        // NEW: Resolve overlay selectors to patches (supports bulk targeting)
        result.overlayPatches = this._resolveOverlaySelectors(rule.apply);
        result.profilesAdd = rule.apply.profiles_add || [];
        result.profilesRemove = rule.apply.profiles_remove || [];
        result.animations = rule.apply.animations || [];
        result.baseSvgUpdate = rule.apply.base_svg || null;  // ✅ NEW: base_svg filter updates
        result.stopAfter = rule.stop === true;

        // DEBUG: Log what we found
        cblcarsLog.debug(`[RulesEngine] 🎨 Rule ${rule.id} matched - apply block:`, {
          hasBaseSvg: !!rule.apply.base_svg,
          baseSvgValue: rule.apply.base_svg,
          hasOverlays: !!rule.apply.overlays,
          overlayCount: result.overlayPatches?.length || 0
        });
      }

      return result;

    } catch (error) {
      const evaluationTime = performance.now() - startTime;

      // Trace error
      this.traceBuffer.addTrace(
        rule.id,
        false,
        {},
        evaluationTime,
        { error: error.message }
      );

      cblcarsLog.warn(`[RulesEngine] ⚠️ Error evaluating rule ${rule.id}:`, error);
      return {
        ruleId: rule.id,
        matched: false,
        error: error.message,
        evaluationTime
      };
    }
  }

  /**
   * Resolve overlay selectors to concrete overlay patches
   *
   * Supports bulk targeting via special selectors:
   * - all: - Target all overlays
   * - type:typename: - Target overlays of specific type
   * - tag:tagname: - Target overlays with specific tag
   * - pattern:regex: - Target overlays matching ID pattern
   * - exclude: - Exclude specific overlay IDs
   * - overlay_id (direct) - Target specific overlay (backwards compatible)
   *
   * @param {Object} ruleApply - Rule 'apply' clause
   * @returns {Array<Object>} Array of overlay patches with {id, style, ...}
   * @private
   */
  _resolveOverlaySelectors(ruleApply) {
    if (!ruleApply.overlays) return [];

    const startTime = performance.now();

    // Get all available overlays from SystemsManager
    const allOverlays = this.systemsManager?.getResolvedModel?.()?.overlays || [];

    if (allOverlays.length === 0) {
      cblcarsLog.debug('[RulesEngine] No overlays available for selector resolution');
      return [];
    }

    // Build exclusion set
    const excludeIds = new Set();
    if (ruleApply.overlays.exclude) {
      const excludeList = Array.isArray(ruleApply.overlays.exclude)
        ? ruleApply.overlays.exclude
        : [ruleApply.overlays.exclude];
      excludeList.forEach(id => excludeIds.add(id));
    }

    // Collect patches by overlay ID (allows merging from multiple selectors)
    const patchMap = new Map();

    // Process each selector
    for (const [selector, patchContent] of Object.entries(ruleApply.overlays)) {
      // Skip exclude key (already processed)
      if (selector === 'exclude') continue;

      let matchedOverlays = [];

      // Selector: all - Match all overlays
      if (selector === 'all') {
        matchedOverlays = allOverlays.filter(o => !excludeIds.has(o.id));
        perfCount('rules.selector.all', 1);
      }
      // Selector: type:typename - Match overlays by type
      else if (selector.startsWith('type:')) {
        const typeName = selector.substring(5); // Remove 'type:' prefix
        matchedOverlays = allOverlays.filter(o =>
          o.type === typeName && !excludeIds.has(o.id)
        );
        perfCount('rules.selector.type', 1);
      }
      // Selector: tag:tagname - Match overlays by tag
      else if (selector.startsWith('tag:')) {
        const tagName = selector.substring(4); // Remove 'tag:' prefix
        matchedOverlays = allOverlays.filter(o => {
          const tags = o.tags || [];
          return tags.includes(tagName) && !excludeIds.has(o.id);
        });
        perfCount('rules.selector.tag', 1);
      }
      // Selector: pattern:regex - Match overlays by ID pattern
      else if (selector.startsWith('pattern:')) {
        const pattern = selector.substring(8); // Remove 'pattern:' prefix
        try {
          const regex = new RegExp(pattern);
          matchedOverlays = allOverlays.filter(o =>
            regex.test(o.id) && !excludeIds.has(o.id)
          );
          perfCount('rules.selector.pattern', 1);
        } catch (e) {
          cblcarsLog.warn(`[RulesEngine] Invalid regex pattern: ${pattern}`, e);
          continue;
        }
      }
      // Direct overlay ID (backwards compatible)
      else {
        const overlay = allOverlays.find(o => o.id === selector);
        if (overlay && !excludeIds.has(overlay.id)) {
          matchedOverlays = [overlay];
        }
        perfCount('rules.selector.direct', 1);
      }

      // Create/merge patches for matched overlays
      matchedOverlays.forEach(overlay => {
        const existing = patchMap.get(overlay.id);
        if (existing) {
          // Merge with existing patch (later selectors override)
          patchMap.set(overlay.id, {
            ...existing,
            ...patchContent,
            style: {
              ...(existing.style || {}),
              ...(patchContent.style || {})
            }
          });
        } else {
          // New patch
          patchMap.set(overlay.id, {
            id: overlay.id,
            ...patchContent
          });
        }
      });

      // Debug logging (if enabled)
      if (window.cblcars?.debug?.rules) {
        cblcarsLog.debug(`[RulesEngine] Selector '${selector}' matched ${matchedOverlays.length} overlay(s)`);
      }
    }

    const patches = Array.from(patchMap.values());
    const resolutionTime = performance.now() - startTime;

    perfCount('rules.selector.resolutions', 1);
    perfCount('rules.selector.patches', patches.length);

    cblcarsLog.debug('[RulesEngine] Selector resolution complete:', {
      selectors: Object.keys(ruleApply.overlays).filter(k => k !== 'exclude').length,
      excluded: excludeIds.size,
      patchesGenerated: patches.length,
      resolutionTime: `${resolutionTime.toFixed(2)}ms`
    });

    return patches;
  }

  evaluateConditions(when, getEntity) {
    if (!when) return {};

    const results = {};

    // Evaluate all conditions
    if (when.all) {
      results.all = when.all.map(condition => this.evaluateCondition(condition, getEntity));
    }

    // Evaluate any conditions
    if (when.any) {
      results.any = when.any.map(condition => this.evaluateCondition(condition, getEntity));
    }

    return results;
  }

  evaluateCondition(condition, getEntity) {
    const result = {
      condition,
      matched: false,
      value: null,
      error: null
    };

    try {
      // Entity state condition (supports both HA entities and DataSource references)
      if (condition.entity) {
        // ENHANCED: Check for auto-created template DataSources first
        let entityData = null;
        let entityValue = null;

        // Try to get entity data directly first (for regular HA entities)
        const entity = getEntity(condition.entity);
        if (entity) {
          entityData = entity;
          entityValue = entity.state;
          cblcarsLog.trace(`[RulesEngine] Found direct entity data for ${condition.entity}:`, entityValue);
        } else {
          // If not found as direct entity, check if there's an auto-created DataSource
          const templateDataSourceName = `template_${condition.entity.replace(/\./g, '_')}`;

          if (this.dataSourceManager) {
            const templateDataSource = this.dataSourceManager.getSource(templateDataSourceName);
            if (templateDataSource) {
              const currentData = templateDataSource.getCurrentData();
              if (currentData && currentData.entity) {
                entityData = currentData.entity;
                // FIXED: For rule evaluation, always use the original HASS state, not the converted value
                // This preserves string states like "on"/"off" for proper rule matching
                const originalState = currentData.entity.state;
                entityValue = originalState;

                cblcarsLog.trace(`[RulesEngine] Found auto-created DataSource ${templateDataSourceName} for ${condition.entity}:`, {
                  dataSourceConvertedValue: currentData.v,
                  originalEntityState: originalState,
                  usingForRules: originalState,
                  entityData: currentData.entity
                });
              } else {
                cblcarsLog.debug(`[RulesEngine] Auto-created DataSource ${templateDataSourceName} exists but has no current data`);
              }
            } else {
              cblcarsLog.debug(`[RulesEngine] No auto-created DataSource found: ${templateDataSourceName}`);
            }
          }
        }

        // If still no data found, check if this is a DataSource reference with dots
        if (!entityData && condition.entity.includes('.') && this.dataSourceManager) {
          const dataSourceValue = this.resolveDataSourceValue(condition.entity);
          if (dataSourceValue !== null) {
            entityValue = dataSourceValue;
            entityData = {
              entity_id: condition.entity,
              state: String(dataSourceValue),
              attributes: {}
            };
            cblcarsLog.trace(`[RulesEngine] Found DataSource reference value for ${condition.entity}:`, entityValue);
          }
        }

        // If we still have no data, return error
        if (!entityData && entityValue === null) {
          result.error = `Entity ${condition.entity} not found in HASS or DataSources`;
          cblcarsLog.trace(`[RulesEngine] Entity.*not found anywhere`);
          return result;
        }

        result.value = entityValue;

        // ENHANCED: Handle different condition types with proper logging
        if (condition.state !== undefined) {
          // Direct state comparison
          const conditionState = String(condition.state);
          const actualState = String(entityValue);
          result.matched = actualState === conditionState;

          cblcarsLog.trace(`[RulesEngine] State comparison for ${condition.entity}:`, {
            actualState: actualState,
            conditionState: conditionState,
            matched: result.matched,
            comparison: `"${actualState}" === "${conditionState}"`
          });
        } else if (condition.above !== undefined) {
          // Numeric comparison - above
          const numValue = parseFloat(entityValue);
          result.matched = !isNaN(numValue) && numValue > condition.above;
          cblcarsLog.trace(`[RulesEngine] Above comparison for ${condition.entity}: ${numValue} > ${condition.above} = ${result.matched}`);
        } else if (condition.below !== undefined) {
          // Numeric comparison - below
          const numValue = parseFloat(entityValue);
          result.matched = !isNaN(numValue) && numValue < condition.below;
          cblcarsLog.trace(`[RulesEngine] Below comparison for ${condition.entity}: ${numValue} < ${condition.below} = ${result.matched}`);
        } else if (condition.equals !== undefined) {
          // Equals comparison
          result.matched = entityValue == condition.equals;
          cblcarsLog.trace(`[RulesEngine] Equals comparison for ${condition.entity}: ${entityValue} == ${condition.equals} = ${result.matched}`);
        } else {
          // Default: entity exists and has a value
          result.matched = true;
          cblcarsLog.trace(`[RulesEngine] Default existence check for ${condition.entity}: ${result.matched}`);
        }
      }

      // Time between condition
      if (condition.time_between) {
        result.matched = this.evaluateTimeBetween(condition.time_between);
        result.value = new Date().toTimeString().substring(0, 5);
      }

      // Time condition with after/before
      if (condition.time) {
        result.matched = this.evaluateTimeCondition(condition.time);
        result.value = new Date().toTimeString().substring(0, 5);
      }

      // Map range condition
      if (condition.map_range_cond) {
        result.matched = this.evaluateMapRangeCondition(condition.map_range_cond, getEntity);
      }

    } catch (error) {
      result.error = error.message;
      cblcarsLog.error(`[RulesEngine] Error evaluating condition for ${condition.entity}:`, error);
    }

    return result;
  }

  evaluateTimeBetween(timeRange) {
    const [startTime, endTime] = timeRange.split('-');
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const start = startHour * 60 + startMin;
    const end = endHour * 60 + endMin;

    if (start <= end) {
      return currentTime >= start && currentTime <= end;
    } else {
      // Crosses midnight
      return currentTime >= start || currentTime <= end;
    }
  }

  /**
   * Evaluate time condition with after/before
   * @param {Object} timeCondition - Time condition with optional after/before
   * @returns {boolean} True if current time matches condition
   */
  evaluateTimeCondition(timeCondition) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    let matchAfter = true;
    let matchBefore = true;

    // Check "after" condition
    if (timeCondition.after) {
      const [afterHour, afterMin] = timeCondition.after.split(':').map(Number);
      const afterMinutes = afterHour * 60 + afterMin;
      matchAfter = currentTime >= afterMinutes;
      cblcarsLog.trace(`[RulesEngine] Time after check: ${currentTime} >= ${afterMinutes} (${timeCondition.after}) = ${matchAfter}`);
    }

    // Check "before" condition
    if (timeCondition.before) {
      const [beforeHour, beforeMin] = timeCondition.before.split(':').map(Number);
      const beforeMinutes = beforeHour * 60 + beforeMin;
      matchBefore = currentTime < beforeMinutes;
      cblcarsLog.trace(`[RulesEngine] Time before check: ${currentTime} < ${beforeMinutes} (${timeCondition.before}) = ${matchBefore}`);
    }

    const finalMatch = matchAfter && matchBefore;
    cblcarsLog.debug(`[RulesEngine] Time condition evaluated: after=${matchAfter}, before=${matchBefore}, final=${finalMatch}`);
    return finalMatch;
  }

  evaluateMapRangeCondition(mapRangeCondition, getEntity) {
    const { entity, input, output, above, below, equals } = mapRangeCondition;

    const entityObj = getEntity(entity);
    if (!entityObj) return false;

    const rawValue = parseFloat(entityObj.state);
    if (isNaN(rawValue)) return false;

    // Map the value
    const mappedValue = this.mapRange(rawValue, input, output);

    // Apply condition on mapped value
    if (above !== undefined) return mappedValue > above;
    if (below !== undefined) return mappedValue < below;
    if (equals !== undefined) return Math.abs(mappedValue - equals) < 0.001;

    return false;
  }

  mapRange(value, inputRange, outputRange) {
    const [inMin, inMax] = inputRange;
    const [outMin, outMax] = outputRange;

    // Clamp input value
    const clampedValue = Math.max(inMin, Math.min(inMax, value));

    // Linear interpolation
    const ratio = (clampedValue - inMin) / (inMax - inMin);
    return outMin + ratio * (outMax - outMin);
  }

  /**
   * Resolve a DataSource reference to its current value
   * @param {string} dataSourceRef - Reference like 'source.transformations.key' or 'source.aggregations.key'
   * @returns {any|null} Resolved value or null if not found
   */
  resolveDataSourceValue(dataSourceRef) {
    try {
      // Parse the DataSource reference
      const parts = dataSourceRef.split('.');
      const sourceName = parts[0];

      // Get the DataSource
      const dataSource = this.dataSourceManager.getSource(sourceName);
      if (!dataSource) {
        return null;
      }

      const currentData = dataSource.getCurrentData();
      if (!currentData) {
        return null;
      }

      // Handle simple DataSource reference (just the source name)
      if (parts.length === 1) {
        return currentData.v;
      }

      // Handle enhanced DataSource references
      if (parts.length >= 3) {
        const dataType = parts[1]; // 'transformations' or 'aggregations'
        const dataKey = parts.slice(2).join('.'); // Support nested keys

        if (dataType === 'transformations' && currentData.transformations) {
          return currentData.transformations[dataKey];
        } else if (dataType === 'aggregations' && currentData.aggregations) {
          const aggData = currentData.aggregations[dataKey];

          // Handle aggregation objects with multiple properties
          if (typeof aggData === 'object' && aggData !== null) {
            // Return the most relevant value from aggregation
            if (aggData.avg !== undefined) return aggData.avg;
            if (aggData.value !== undefined) return aggData.value;
            if (aggData.last !== undefined) return aggData.last;
            if (aggData.current !== undefined) return aggData.current;
            return aggData; // Return the object itself if no standard property
          }

          return aggData;
        }
      }

      return null;
    } catch (error) {
      cblcarsLog.warn(`[RulesEngine] ⚠️ Error resolving DataSource reference '${dataSourceRef}':`, error);
      return null;
    }
  }

  determineMatch(when, conditions) {
    if (!when) return false;

    let allMatch = true;
    let anyMatch = false;

    // Check all conditions
    if (when.all && conditions.all) {
      allMatch = conditions.all.every(result => result.matched);
    }

    // Check any conditions
    if (when.any && conditions.any) {
      anyMatch = conditions.any.some(result => result.matched);
    }

    // Determine final match
    if (when.all && when.any) {
      return allMatch && anyMatch;
    } else if (when.all) {
      return allMatch;
    } else if (when.any) {
      return anyMatch;
    }

    return false;
  }

  aggregateResults(ruleResults) {
    const aggregated = {
      overlayPatches: [],
      profilesAdd: [],
      profilesRemove: [],
      animations: [],
      baseSvgUpdate: null  // ✅ NEW: Aggregate base_svg updates
    };

    // Group results by target overlays for stop semantics
    const overlayGroups = new Map();

    ruleResults.forEach(result => {
      if (result.overlayPatches) {
        result.overlayPatches.forEach(patch => {
          if (!overlayGroups.has(patch.id)) {
            overlayGroups.set(patch.id, []);
          }
          overlayGroups.get(patch.id).push({
            ...result,
            overlayPatch: patch
          });
        });
      }
    });

    // Process each overlay group with stop semantics
    overlayGroups.forEach((rules, overlayId) => {
      this.processOverlayRules(overlayId, rules, aggregated);
    });

    // Add non-overlay results (profiles, animations, base_svg)
    ruleResults
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .forEach(result => {
        if (result.profilesAdd) {
          aggregated.profilesAdd.push(...result.profilesAdd);
        }
        if (result.profilesRemove) {
          aggregated.profilesRemove.push(...result.profilesRemove);
        }
        if (result.animations) {
          aggregated.animations.push(...result.animations);
        }
        // ✅ NEW: Take the first (highest priority) base_svg update
        if (result.baseSvgUpdate && !aggregated.baseSvgUpdate) {
          aggregated.baseSvgUpdate = result.baseSvgUpdate;
        }
      });

    return aggregated;
  }

  processOverlayRules(overlayId, rules, aggregated) {
    // Sort by priority (higher first)
    const sortedRules = rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    let shouldStop = false;

    sortedRules.forEach(result => {
      if (shouldStop) {
        // Rule was stopped, add to trace
        this.traceBuffer.addTrace(
          result.ruleId,
          result.matched,
          result.conditions,
          result.evaluationTime,
          {
            stopped: true,
            stoppedBy: overlayId,
            reason: 'stop_semantics'
          }
        );

        perfCount('rules.stopped', 1);
        return;
      }

      // Apply the rule result
      if (result.overlayPatch) {
        aggregated.overlayPatches.push(result.overlayPatch);
      }

      // Check for stop condition
      if (result.stopAfter) {
        shouldStop = true;
        perfCount('rules.stop.triggered', 1);

        // Add stop trace
        this.traceBuffer.addTrace(
          result.ruleId,
          result.matched,
          result.conditions,
          result.evaluationTime,
          {
            stopTriggered: true,
            affectedOverlay: overlayId
          }
        );
      }
    });
  }

  countConditions(when) {
    if (!when) return 0;
    return (when.all?.length || 0) + (when.any?.length || 0);
  }

  createEmptyResult() {
    return {
      overlayPatches: [],
      profilesAdd: [],
      profilesRemove: [],
      animations: [],
      baseSvgUpdate: null  // ✅ NEW: Include base_svg in empty result
    };
  }

  /**
   * Set up HASS state monitoring for rule entities
   * @param {Object} hass - Home Assistant instance
   * @returns {Promise<void>}
   */
  async setupHassMonitoring(hass) {
    if (!hass?.connection?.subscribeEvents || this.hassUnsubscribe) {
      cblcarsLog.debug('[RulesEngine] HASS monitoring already set up or unavailable');
      return;
    }

    // Extract all HASS entities referenced in rules (exclude DataSource references)
    const allEntityReferences = Array.from(this.dependencyIndex?.entityToRules.keys() || []);
    cblcarsLog.debug('[RulesEngine] 🔍 All entity references from dependency index:', allEntityReferences);

    // Filter out DataSource references
    const ruleEntities = allEntityReferences.filter(entityId => {
      // Skip DataSource references (contain dots and match DataSource pattern)
      if (entityId.includes('.')) {
        const sourceName = entityId.split('.')[0];
        if (this.dataSourceManager?.getSource(sourceName)) {
          cblcarsLog.debug(`[RulesEngine] 🚫 Filtered out DataSource reference: ${entityId}`);
          return false;
        }
      }
      cblcarsLog.debug(`[RulesEngine] ✅ Including HASS entity: ${entityId}`);
      return true;
    });

    cblcarsLog.debug(`[RulesEngine] 📊 HASS entity monitoring summary:`, {
      totalReferences: allEntityReferences.length,
      dataSourceReferences: allEntityReferences.length - ruleEntities.length,
      hassEntities: ruleEntities.length,
      hassEntityList: ruleEntities
    });

    if (ruleEntities.length === 0) {
      cblcarsLog.debug('[RulesEngine] No HASS entities found in rules for monitoring (all references are DataSources)');
      return;
    }

    // Cache entity list for performance
    this._hassEntities = new Set(ruleEntities);

    cblcarsLog.debug(`[RulesEngine] Setting up monitoring for ${ruleEntities.length} rule entities:`, ruleEntities);

    // Direct subscription - following DataSource pattern
    try {
      this.hassUnsubscribe = await hass.connection.subscribeEvents((event) => {
        if (event.event_type === 'state_changed' && event.data?.entity_id) {
          const entityId = event.data.entity_id;

          // Performance: Use cached Set for O(1) lookup
          if (this._hassEntities.has(entityId)) {
            this._handleRuleEntityChange(entityId, event.data);
          }
        }
      }, 'state_changed');

      cblcarsLog.debug('[RulesEngine] ✅ HASS state monitoring enabled');
    } catch (error) {
      cblcarsLog.error('[RulesEngine] ❌ Failed to set up HASS monitoring:', error);
      throw error;
    }
  }

  /**
   * Handle state change for rule-referenced entities
   * @private
   * @param {string} entityId - Changed entity ID
   * @param {Object} eventData - State change event data
   */
  _handleRuleEntityChange(entityId, eventData) {
    cblcarsLog.debug(`[RulesEngine] Processing entity change: ${entityId} -> ${eventData.new_state?.state}`);

    // Cache the fresh state from the event for immediate use
    if (eventData.new_state) {
      this._freshStateCache.set(entityId, {
        entity_id: entityId,
        state: eventData.new_state.state,
        attributes: eventData.new_state.attributes || {},
        last_changed: eventData.new_state.last_changed,
        last_updated: eventData.new_state.last_updated
      });
      cblcarsLog.trace(`[RulesEngine] Cached fresh state for ${entityId}: ${eventData.new_state.state}`);
    }

    // Mark affected rules as dirty using existing infrastructure
    const affectedRules = this.markEntitiesDirty([entityId]);

    if (affectedRules > 0) {
      cblcarsLog.debug(`[RulesEngine] Entity ${entityId} changed, marked ${affectedRules} rules dirty`);

      // Trigger re-evaluation if callback is set
      if (this._reEvaluationCallback) {
        try {
          this._reEvaluationCallback();
        } catch (error) {
          cblcarsLog.error('[RulesEngine] Re-evaluation callback failed:', error);
        }
      }
    }

    // Clear the cache after evaluation (it will be stale for next change)
    // Do this async so the callback completes first
    setTimeout(() => {
      this._freshStateCache.delete(entityId);
      cblcarsLog.trace(`[RulesEngine] Cleared cached state for ${entityId}`);
    }, 100);
  }

  /**
   * Set callback for when rules need re-evaluation
   * @param {Function} callback - Re-evaluation callback function
   */
  setReEvaluationCallback(callback) {
    if (typeof callback !== 'function') {
      cblcarsLog.warn('[RulesEngine] Re-evaluation callback must be a function');
      return;
    }

    this._reEvaluationCallback = callback;
    cblcarsLog.debug('[RulesEngine] Re-evaluation callback set');
  }

  /**
   * Clean up HASS subscription and resources
   * @returns {Promise<void>}
   */
  async destroy() {
    if (this.hassUnsubscribe) {
      try {
        this.hassUnsubscribe();
        this.hassUnsubscribe = null;
        this._hassEntities.clear();
        cblcarsLog.debug('[RulesEngine] HASS subscription cleaned up');
      } catch (error) {
        cblcarsLog.warn('[RulesEngine] Error cleaning up HASS subscription:', error);
      }
    }

    this._reEvaluationCallback = null;
  }

  /**
   * Set the DataSourceManager reference (for cases where it wasn't available during construction)
   * @param {Object} dataSourceManager - DataSourceManager instance
   */
  setDataSourceManager(dataSourceManager) {
    cblcarsLog.debug(`[RulesEngine] Setting DataSourceManager with ${Object.keys(dataSourceManager?.sources || {}).length} sources`);
    this.dataSourceManager = dataSourceManager;

    // Rebuild dependency index to include DataSource references
    this.buildDependencyIndex();

    // Mark all rules dirty since DataSource conditions might now be evaluable
    this.markAllDirty();

    cblcarsLog.debug(`[RulesEngine] DataSourceManager set, rebuilt dependencies and marked ${this.dirtyRules.size} rules dirty`);
  }

  getRuleDependencies(ruleId) {
    return this.dependencyIndex?.ruleToEntities.get(ruleId) || [];
  }

  getEntityDependents(entityId) {
    return Array.from(this.dependencyIndex?.entityToRules.get(entityId) || []);
  }

  // Enhanced debug and introspection methods
  getTrace() {
    const baseTrace = {
      totalRules: this.rules.length,
      dirtyRules: this.dirtyRules.size,
      lastEvaluations: Object.fromEntries(this.lastEvaluation),
      evalCounts: { ...this.evalCounts },
      dependencyStats: {
        entitiesTracked: this.dependencyIndex?.entityToRules.size || 0,
        avgRulesPerEntity: this.dependencyIndex ?
          Array.from(this.dependencyIndex.entityToRules.values()).reduce((sum, rules) => sum + rules.size, 0) / this.dependencyIndex.entityToRules.size : 0
      }
    };

    // Add trace buffer stats
    const traceStats = this.traceBuffer.getStats();
    baseTrace.traceStats = traceStats;

    return baseTrace;
  }

  getRuleTrace(ruleId, limit = 20) {
    return this.traceBuffer.getRuleHistory(ruleId, limit);
  }

  getRecentMatches(timeWindow = 60000) {
    return this.traceBuffer.getMatchedRules(timeWindow);
  }

  exportTrace(options = {}) {
    return this.traceBuffer.exportTraces(options);
  }

  clearTrace() {
    this.traceBuffer.clear();
    perfCount('rules.trace.cleared', 1);
  }
}

/**
 * Helper function for applying overlay patches from rule results
 * Handles special cases like status_grid cell patches and ApexChart updates
 * @param {Array} overlays - Array of overlay configurations
 * @param {Array} patches - Array of patch configurations from rules
 * @returns {Array} Patched overlays array
 */
export function applyOverlayPatches(overlays, patches) {
  if (!patches || patches.length === 0) {
    return overlays;
  }

  cblcarsLog.debug('[RulesEngine] 🎨 Applying overlay patches:', {
    overlayCount: overlays.length,
    patchCount: patches.length,
    patches: patches.map(p => ({
      id: p.id,
      type: overlays.find(o => o.id === p.id)?.type,
      styleKeys: Object.keys(p.style || {}),
      cellTarget: p.cell_target || p.cellTarget || null
    }))
  });

  const patchMap = new Map(patches.map(patch => [patch.id, patch]));

  // Track ApexChart overlays that need updates
  const apexChartUpdates = [];

  const patchedOverlays = overlays.map(overlay => {
    const patch = patchMap.get(overlay.id);
    if (!patch) {
      return overlay;
    }

    cblcarsLog.debug('[RulesEngine] 🎯 Applying patch to overlay:', {
      id: overlay.id,
      type: overlay.type,
      cellTarget: patch.cell_target || patch.cellTarget,
      originalStyle: overlay.style,
      patch: patch.style
    });

    // Handle cell-specific patches for status_grid overlays
    if (overlay.type === 'status_grid' && (patch.cell_target || patch.cellTarget)) {
      return applyStatusGridCellPatch(overlay, patch);
    }

    // Track ApexChart patches for deferred update
    if (overlay.type === 'apexchart') {
      apexChartUpdates.push({
        overlay: { ...overlay },
        patch
      });
    }

    // FIXED: For non-cell-targeted patches, apply to overlay level
    // But mark them so they don't cascade to individual cells
    const patchedOverlay = {
      ...overlay,
      style: {
        ...overlay.style,
        ...patch.style
      },
      finalStyle: {
        ...(overlay.finalStyle || overlay.style || {}),
        ...patch.style
      },
      // ADDED: Mark that this is an overlay-level patch, not cell-level
      _hasOverlayLevelPatch: !patch.cell_target && !patch.cellTarget
    };

    cblcarsLog.debug('[RulesEngine] ✅ Patched overlay result:', {
      id: patchedOverlay.id,
      type: patchedOverlay.type,
      newStyle: patchedOverlay.style,
      newFinalStyle: patchedOverlay.finalStyle
    });

    return patchedOverlay;
  });
  return patchedOverlays;
}

/**
 * Apply cell-specific patches to status_grid overlays
 * @private
 */
function applyStatusGridCellPatch(overlay, patch) {
  const cellTarget = patch.cell_target || patch.cellTarget;

  cblcarsLog.info('[RulesEngine] 🔲 APPLYING status_grid cell patch:', {
    overlayId: overlay.id,
    cellTarget,
    cellPatch: patch.style,
    currentCellCount: overlay.cells?.length || 0
  });

  // Clone the overlay to avoid mutations
  const patchedOverlay = {
    ...overlay,
    cells: overlay.cells ? [...overlay.cells] : [],
    // ADDED: Store cell-specific patches separately to prevent cascade
    _cellPatches: {
      ...(overlay._cellPatches || {}),
      [cellTarget.cell_id || `${cellTarget.row}-${cellTarget.col}`]: patch.style
    }
  };

  let patchedCellCount = 0;

  // Find and patch the target cell(s)
  if (patchedOverlay.cells) {
    patchedOverlay.cells = patchedOverlay.cells.map(cell => {
      // Check if this cell matches the target
      const isTargetCell = matchesStatusGridCellTarget(cell, cellTarget);

      if (isTargetCell) {
        patchedCellCount++;
        cblcarsLog.info('[RulesEngine] 🎯 PATCHING CELL:', {
          cellId: cell.id,
          position: [cell.row, cell.col],
          originalColor: cell.color || cell.cell_color,
          patchColor: patch.style.color || patch.style.cell_color,
          patchBracketColor: patch.style.bracket_color,
          patch: patch.style
        });

        const patchedCell = {
          ...cell,
          // CHANGED: Store patches in a separate property to prevent cascade during style resolution
          _rulePatch: patch.style,

          // Apply cell-level style overrides
          // Support both 'color' and 'cell_color' (StatusGrid uses 'cell_color')
          color: patch.style.color || patch.style.cell_color || cell.color || cell.cell_color,
          cell_color: patch.style.cell_color || patch.style.color || cell.cell_color || cell.color,

          // StatusGrid-specific properties
          bracket_color: patch.style.bracket_color !== undefined ? patch.style.bracket_color : cell.bracket_color,
          cell_opacity: patch.style.cell_opacity !== undefined ? patch.style.cell_opacity : cell.cell_opacity,
          lcars_button_preset: patch.style.lcars_button_preset !== undefined ? patch.style.lcars_button_preset : cell.lcars_button_preset,
          text_layout: patch.style.text_layout !== undefined ? patch.style.text_layout : cell.text_layout,
          label_color: patch.style.label_color !== undefined ? patch.style.label_color : cell.label_color,
          value_color: patch.style.value_color !== undefined ? patch.style.value_color : cell.value_color,

          // Border properties
          border: patch.style.border !== undefined ? patch.style.border : cell.border,

          // Generic properties
          radius: patch.style.radius !== undefined ? patch.style.radius : cell.radius,
          font_size: patch.style.font_size !== undefined ? patch.style.font_size : cell.font_size,

          // Support content override
          content: patch.content !== undefined ? patch.content : cell.content,
          label: patch.label !== undefined ? patch.label : cell.label,

          // Support visibility control
          visible: patch.visible !== undefined ? patch.visible : (cell.visible !== undefined ? cell.visible : true),

          // Merge style object for StatusGrid style resolution
          style: {
            ...(cell.style || {}),
            ...(patch.style || {})
          }
        };

        cblcarsLog.info('[RulesEngine] ✅ CELL PATCHED RESULT:', {
          cellId: patchedCell.id,
          newColor: patchedCell.color,
          newCellColor: patchedCell.cell_color,
          newBracketColor: patchedCell.bracket_color,
          hadColorChange: (cell.color || cell.cell_color) !== (patchedCell.color || patchedCell.cell_color)
        });

        return patchedCell;
      }

      return cell;
    });
  }

  cblcarsLog.info('[RulesEngine] 🔲 CELL PATCH COMPLETE:', {
    overlayId: overlay.id,
    totalCells: patchedOverlay.cells.length,
    cellsPatched: patchedCellCount
  });

  // REMOVED: Don't apply overlay-level styles for cell-targeted patches
  // This was causing the cascade issue

  return patchedOverlay;
}

/**
 * Check if a cell matches the targeting criteria
 * @private
 */
function matchesStatusGridCellTarget(cell, cellTarget) {
  // Target by cell ID
  if (cellTarget.cell_id && cell.id === cellTarget.cell_id) {
    return true;
  }

  // Target by position [row, col]
  if (cellTarget.position && Array.isArray(cellTarget.position)) {
    const [targetRow, targetCol] = cellTarget.position;
    return cell.row === targetRow && cell.col === targetCol;
  }

  // Target by row/column individually
  if (cellTarget.row !== undefined && cellTarget.row === cell.row) {
    if (cellTarget.col === undefined || cellTarget.col === cell.col) {
      return true;
    }
  }

  // ✨ NEW: Target by tag(s)
  // Single tag: {tag: "critical"}
  if (cellTarget.tag) {
    const cellTags = cell.tags || [];
    return cellTags.includes(cellTarget.tag);
  }

  // Multiple tags: {tags: ["critical", "propulsion"], match_all: true}
  if (cellTarget.tags && Array.isArray(cellTarget.tags)) {
    const cellTags = cell.tags || [];
    const matchAll = cellTarget.match_all === true;

    if (matchAll) {
      // AND logic: Cell must have ALL specified tags
      return cellTarget.tags.every(tag => cellTags.includes(tag));
    } else {
      // OR logic (default): Cell must have ANY of the specified tags
      return cellTarget.tags.some(tag => cellTags.includes(tag));
    }
  }

  return false;
}

// ============================================================================
// PHASE 1: New HASS Ingestion Method (Step 1 - Add alongside existing)
// ============================================================================

