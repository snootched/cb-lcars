import { perfTime, perfCount } from '../util/performance.js';
import { globalTraceBuffer } from './RuleTraceBuffer.js';

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
        entities.add(condition.entity);

        // NEW: Check if this is a datasource reference
        if (condition.entity.includes('.') && this.dataSourceManager) {
          const sourceId = condition.entity.split('.')[0];
          if (this.dataSourceManager.getSource(sourceId)) {
            // Add the source itself to dependencies
            entities.add(sourceId);
          }
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
      const rules = this.dependencyIndex.entityToRules.get(entityId);
      if (rules) {
        rules.forEach(ruleId => {
          if (!this.dirtyRules.has(ruleId)) {
            this.dirtyRules.add(ruleId);
            affectedRules++;
          }
        });
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

      // NEW: Use DataSourceManager's enhanced getEntity if available
      if (!getEntity && this.dataSourceManager) {
        getEntity = (entityId) => this.dataSourceManager.getEntity(entityId);
      }

      if (!getEntity || typeof getEntity !== 'function') {
        console.warn('[RulesEngine] evaluateDirty called without getEntity function');
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
        result.overlayPatches = rule.apply.overlays || [];
        result.profilesAdd = rule.apply.profiles_add || [];
        result.profilesRemove = rule.apply.profiles_remove || [];
        result.animations = rule.apply.animations || [];
        result.stopAfter = rule.stop === true;
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

      console.warn(`[RulesEngine] Error evaluating rule ${rule.id}:`, error);
      return {
        ruleId: rule.id,
        matched: false,
        error: error.message,
        evaluationTime
      };
    }
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
      // Entity state condition
      if (condition.entity) {
        const entity = getEntity(condition.entity);
        if (!entity) {
          result.error = `Entity ${condition.entity} not found`;
          return result;
        }

        result.value = entity.state;

        // Numeric comparisons
        if (condition.above !== undefined) {
          const numValue = parseFloat(entity.state);
          result.matched = !isNaN(numValue) && numValue > condition.above;
        } else if (condition.below !== undefined) {
          const numValue = parseFloat(entity.state);
          result.matched = !isNaN(numValue) && numValue < condition.below;
        } else if (condition.equals !== undefined) {
          result.matched = entity.state == condition.equals;
        } else {
          result.matched = true; // Entity exists
        }
      }

      // Time between condition
      if (condition.time_between) {
        result.matched = this.evaluateTimeBetween(condition.time_between);
        result.value = new Date().toTimeString().substring(0, 5);
      }

      // Map range condition
      if (condition.map_range_cond) {
        result.matched = this.evaluateMapRangeCondition(condition.map_range_cond, getEntity);
      }

    } catch (error) {
      result.error = error.message;
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
      animations: []
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

    // Add non-overlay results (profiles, animations)
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
      animations: []
    };
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

  getRuleDependencies(ruleId) {
    return this.dependencyIndex?.ruleToEntities.get(ruleId) || [];
  }

  getEntityDependents(entityId) {
    return Array.from(this.dependencyIndex?.entityToRules.get(entityId) || []);
  }
}

// Helper function for applying overlay patches from rule results
export function applyOverlayPatches(overlays, patches) {
  if (!Array.isArray(patches) || patches.length === 0) {
    return overlays;
  }

  const result = overlays.map(overlay => ({ ...overlay }));
  const overlayMap = new Map(result.map(o => [o.id, o]));

  patches.forEach(patch => {
    const overlay = overlayMap.get(patch.id);
    if (overlay && patch.style) {
      // Shallow merge the style patch
      overlay.style = {
        ...overlay.style,
        ...patch.style
      };
    }
  });

  return result;
}
