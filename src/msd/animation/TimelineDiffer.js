import { perfTime } from '../util/performance.js';
import { computeObjectHash } from '../util/hashing.js';

/**
 * Timeline diffing system for efficient animation updates
 * Detects structural vs parameter changes for smart updates
 */
export class TimelineDiffer {
  constructor() {
    this.lastTimelines = new Map(); // timelineId -> hash
    this.lastFullHash = null;
  }

  /**
   * Compute comprehensive diff between current and desired timelines
   */
  diffTimelines(current, desired) {
    return perfTime('timeline.diff', () => {
      const changes = {
        added: [],
        removed: [],
        modified: [],
        unchanged: [],
        structuralChange: false,
        parameterChanges: []
      };

      const currentIds = new Set((current || []).map(t => t.id));
      const desiredIds = new Set((desired || []).map(t => t.id));

      // Detect additions and modifications
      (desired || []).forEach(timeline => {
        if (!currentIds.has(timeline.id)) {
          changes.added.push(timeline);
          changes.structuralChange = true;
        } else {
          const existing = current.find(t => t.id === timeline.id);
          const changeType = this.analyzeTimelineChange(existing, timeline);

          if (changeType.changed) {
            changes.modified.push({
              existing,
              desired: timeline,
              changeType
            });

            if (changeType.structural) {
              changes.structuralChange = true;
            } else {
              changes.parameterChanges.push({
                timelineId: timeline.id,
                changes: changeType.parameterChanges
              });
            }
          } else {
            changes.unchanged.push(timeline);
          }
        }
      });

      // Detect removals
      (current || []).forEach(timeline => {
        if (!desiredIds.has(timeline.id)) {
          changes.removed.push(timeline);
          changes.structuralChange = true;
        }
      });

      return changes;
    });
  }

  /**
   * Analyze specific changes between two timeline versions
   */
  analyzeTimelineChange(existing, desired) {
    const result = {
      changed: false,
      structural: false,
      parameterChanges: []
    };

    // Check global properties
    const globalChanges = this.compareGlobals(existing.globals, desired.globals);
    if (globalChanges.changed) {
      result.changed = true;
      if (globalChanges.structural) {
        result.structural = true;
      }
      result.parameterChanges.push(...globalChanges.changes);
    }

    // Check steps array
    const stepsChanges = this.compareSteps(existing.steps || [], desired.steps || []);
    if (stepsChanges.changed) {
      result.changed = true;
      if (stepsChanges.structural) {
        result.structural = true;
      }
      result.parameterChanges.push(...stepsChanges.changes);
    }

    return result;
  }

  /**
   * Compare timeline global properties
   */
  compareGlobals(existingGlobals, desiredGlobals) {
    const existing = existingGlobals || {};
    const desired = desiredGlobals || {};

    const result = {
      changed: false,
      structural: false,
      changes: []
    };

    const allKeys = new Set([...Object.keys(existing), ...Object.keys(desired)]);

    allKeys.forEach(key => {
      const existingValue = existing[key];
      const desiredValue = desired[key];

      if (existingValue !== desiredValue) {
        result.changed = true;

        const change = {
          type: 'global',
          property: key,
          from: existingValue,
          to: desiredValue
        };

        // Determine if this is a structural change
        if (key === 'autoplay' || key === 'direction') {
          change.structural = true;
          result.structural = true;
        }

        result.changes.push(change);
      }
    });

    return result;
  }

  /**
   * Compare timeline steps arrays
   */
  compareSteps(existingSteps, desiredSteps) {
    const result = {
      changed: false,
      structural: false,
      changes: []
    };

    // Different number of steps = structural change
    if (existingSteps.length !== desiredSteps.length) {
      result.changed = true;
      result.structural = true;
      result.changes.push({
        type: 'steps',
        property: 'count',
        from: existingSteps.length,
        to: desiredSteps.length,
        structural: true
      });
      return result;
    }

    // Compare each step
    existingSteps.forEach((existingStep, index) => {
      const desiredStep = desiredSteps[index];
      const stepChanges = this.compareStep(existingStep, desiredStep, index);

      if (stepChanges.changed) {
        result.changed = true;
        if (stepChanges.structural) {
          result.structural = true;
        }
        result.changes.push(...stepChanges.changes);
      }
    });

    return result;
  }

  /**
   * Compare individual timeline steps
   */
  compareStep(existingStep, desiredStep, stepIndex) {
    const result = {
      changed: false,
      structural: false,
      changes: []
    };

    // Check structural properties
    const structuralProps = ['targets', 'preset', 'offset'];

    structuralProps.forEach(prop => {
      const existingValue = existingStep[prop];
      const desiredValue = desiredStep[prop];

      if (JSON.stringify(existingValue) !== JSON.stringify(desiredValue)) {
        result.changed = true;
        result.structural = true;
        result.changes.push({
          type: 'step',
          stepIndex,
          property: prop,
          from: existingValue,
          to: desiredValue,
          structural: true
        });
      }
    });

    // Check parameter properties
    const parameterProps = ['params'];

    parameterProps.forEach(prop => {
      const paramChanges = this.compareParameters(
        existingStep[prop] || {},
        desiredStep[prop] || {},
        `step[${stepIndex}].${prop}`
      );

      if (paramChanges.length > 0) {
        result.changed = true;
        result.changes.push(...paramChanges);
      }
    });

    return result;
  }

  /**
   * Compare parameter objects for changes
   */
  compareParameters(existing, desired, path) {
    const changes = [];
    const allKeys = new Set([...Object.keys(existing), ...Object.keys(desired)]);

    allKeys.forEach(key => {
      const existingValue = existing[key];
      const desiredValue = desired[key];
      const fullPath = `${path}.${key}`;

      if (typeof existingValue === 'object' && typeof desiredValue === 'object' &&
          existingValue !== null && desiredValue !== null) {
        // Recursive comparison for nested objects
        const nestedChanges = this.compareParameters(existingValue, desiredValue, fullPath);
        changes.push(...nestedChanges);
      } else if (existingValue !== desiredValue) {
        changes.push({
          type: 'parameter',
          property: fullPath,
          from: existingValue,
          to: desiredValue,
          structural: false
        });
      }
    });

    return changes;
  }

  /**
   * Check if timeline collection has any structural changes
   */
  hasStructuralChanges(timelinesDiff) {
    return timelinesDiff.structuralChange ||
           timelinesDiff.added.length > 0 ||
           timelinesDiff.removed.length > 0 ||
           timelinesDiff.modified.some(mod => mod.changeType.structural);
  }

  /**
   * Get optimized update strategy based on diff
   */
  getUpdateStrategy(timelinesDiff) {
    if (!timelinesDiff.added.length && !timelinesDiff.removed.length && !timelinesDiff.modified.length) {
      return { strategy: 'none', reason: 'no_changes' };
    }

    if (this.hasStructuralChanges(timelinesDiff)) {
      return {
        strategy: 'recreate',
        reason: 'structural_changes',
        details: {
          added: timelinesDiff.added.length,
          removed: timelinesDiff.removed.length,
          structuralMods: timelinesDiff.modified.filter(m => m.changeType.structural).length
        }
      };
    }

    if (timelinesDiff.parameterChanges.length > 0) {
      return {
        strategy: 'update_parameters',
        reason: 'parameter_changes_only',
        changes: timelinesDiff.parameterChanges
      };
    }

    return { strategy: 'none', reason: 'no_effective_changes' };
  }

  /**
   * Export diff analysis for debugging
   */
  exportDiff(diff, options = {}) {
    const summary = {
      timestamp: Date.now(),
      structuralChange: diff.structuralChange,
      counts: {
        added: diff.added.length,
        removed: diff.removed.length,
        modified: diff.modified.length,
        unchanged: diff.unchanged.length,
        parameterChanges: diff.parameterChanges.length
      },
      updateStrategy: this.getUpdateStrategy(diff)
    };

    if (options.includeDetails) {
      summary.details = {
        added: diff.added.map(t => ({ id: t.id, steps: t.steps?.length || 0 })),
        removed: diff.removed.map(t => ({ id: t.id })),
        modified: diff.modified.map(m => ({
          id: m.desired.id,
          changeType: m.changeType
        })),
        parameterChanges: diff.parameterChanges
      };
    }

    return options.format === 'json' ?
      JSON.stringify(summary, null, 2) :
      summary;
  }
}

// Global differ instance
const globalTimelineDiffer = new TimelineDiffer();

export { globalTimelineDiffer };
