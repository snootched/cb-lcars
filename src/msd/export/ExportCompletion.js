import { perfTime, perfTimeAsync } from '../util/performance.js';
import { computeObjectHash } from '../util/hashing.js';

/**
 * Complete export system with full snapshot capabilities
 * Supports multiple formats and comprehensive metadata inclusion
 */
export class ExportCompletion {
  constructor() {
    this.exportHistory = [];
    this.maxHistorySize = 50;
  }

  /**
   * Export full system snapshot with all metadata
   */
  async exportFullSnapshot(pipeline, options = {}) {
    return await perfTimeAsync('export.full.snapshot', async () => {
      const {
        includeProvenance = true,
        includePerformance = true,
        includeRuleTraces = false,
        includeAnimationStats = false,
        format = 'json',
        compress = false
      } = options;

      const snapshot = {
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          export_format: format,
          options: { includeProvenance, includePerformance, includeRuleTraces, includeAnimationStats }
        },
        config: this.extractCleanConfig(pipeline.getResolvedModel()),
        anchors: this.extractAnchorData(pipeline),
        overlays: this.extractOverlayData(pipeline),
        rules: this.extractRulesData(pipeline),
        animations: this.extractAnimationData(pipeline)
      };

      // Optional metadata sections
      if (includeProvenance) {
        snapshot.provenance = this.extractProvenanceData(pipeline);
      }

      if (includePerformance) {
        snapshot.performance = await this.extractPerformanceData(pipeline);
      }

      if (includeRuleTraces) {
        snapshot.ruleTraces = this.extractRuleTraces(pipeline);
      }

      if (includeAnimationStats) {
        snapshot.animationStats = this.extractAnimationStats(pipeline);
      }

      // Record export in history
      this.recordExport(snapshot.meta, options);

      // Format and return
      return this.formatSnapshot(snapshot, format, compress);
    });
  }

  /**
   * Export configuration diff between two states
   */
  exportConfigDiff(configA, configB, options = {}) {
    return perfTime('export.config.diff', () => {
      const diff = {
        meta: {
          timestamp: new Date().toISOString(),
          comparison: {
            a_checksum: configA.checksum,
            b_checksum: configB.checksum,
            identical: configA.checksum === configB.checksum
          }
        },
        changes: this.computeComprehensiveDiff(configA, configB)
      };

      return this.formatDiff(diff, options.format || 'json');
    });
  }

  /**
   * Export system health report
   */
  exportHealthReport(pipeline, options = {}) {
    return perfTime('export.health.report', () => {
      const report = {
        meta: {
          timestamp: new Date().toISOString(),
          system_uptime: Date.now() - (pipeline.startTime || Date.now())
        },
        health: {
          overall: 'healthy', // Will be computed
          issues: [],
          warnings: []
        },
        performance: this.analyzePerformanceHealth(pipeline),
        memory: this.analyzeMemoryHealth(pipeline),
        cache: this.analyzeCacheHealth(pipeline),
        rules: this.analyzeRulesHealth(pipeline),
        animations: this.analyzeAnimationHealth(pipeline)
      };

      // Compute overall health
      report.health.overall = this.computeOverallHealth(report);

      return options.format === 'json' ?
        JSON.stringify(report, null, 2) :
        report;
    });
  }

  /**
   * Extract clean configuration without metadata
   */
  extractCleanConfig(resolvedModel) {
    const clean = {};
    const coreFields = [
      'version', 'view_box', 'anchors', 'palettes', 'overlays',
      'rules', 'animations', 'timelines', 'profiles', 'routing',
      'data_sources', 'active_profiles'
    ];

    coreFields.forEach(field => {
      if (resolvedModel[field] !== undefined) {
        clean[field] = this.stripMetadata(resolvedModel[field]);
      }
    });

    return clean;
  }

  /**
   * Extract comprehensive anchor data
   */
  extractAnchorData(pipeline) {
    const model = pipeline.getResolvedModel();
    const anchors = {
      total: Object.keys(model.anchors || {}).length,
      types: {},
      coordinates: {}
    };

    Object.entries(model.anchors || {}).forEach(([id, coords]) => {
      const provenance = model.__provenance?.anchors?.[id];

      anchors.coordinates[id] = coords;

      if (provenance) {
        const type = provenance.origin_type || 'unknown';
        anchors.types[type] = (anchors.types[type] || 0) + 1;
      }
    });

    return anchors;
  }

  /**
   * Extract overlay rendering data
   */
  extractOverlayData(pipeline) {
    const model = pipeline.getResolvedModel();
    const overlays = {
      total: (model.overlays || []).length,
      by_type: {},
      with_animations: 0,
      with_rules: 0
    };

    (model.overlays || []).forEach(overlay => {
      // Count by type
      overlays.by_type[overlay.type] = (overlays.by_type[overlay.type] || 0) + 1;

      // Check for animations
      if (overlay.animation_ref || overlay.animation_hash) {
        overlays.with_animations++;
      }

      // Check for rule applications
      if (overlay.__appliedRules && overlay.__appliedRules.length > 0) {
        overlays.with_rules++;
      }
    });

    return overlays;
  }

  /**
   * Extract rules evaluation data
   */
  extractRulesData(pipeline) {
    const model = pipeline.getResolvedModel();
    const rulesEngine = pipeline.getRulesEngine?.();

    const rules = {
      total: (model.rules || []).length,
      with_dependencies: 0,
      avg_conditions: 0
    };

    if (rulesEngine) {
      const trace = rulesEngine.getTrace();
      rules.performance = {
        total_evaluations: trace.evalCounts?.total || 0,
        matches: trace.evalCounts?.matched || 0,
        hit_rate: trace.evalCounts?.total > 0 ?
          trace.evalCounts.matched / trace.evalCounts.total : 0
      };

      rules.dependencies = {
        entities_tracked: trace.dependencyStats?.entitiesTracked || 0,
        avg_rules_per_entity: trace.dependencyStats?.avgRulesPerEntity || 0
      };
    }

    return rules;
  }

  /**
   * Extract animation performance data
   */
  extractAnimationData(pipeline) {
    const animations = {
      total: 0,
      cached: 0,
      reuse_rate: 0
    };

    // Get animation registry stats if available
    try {
      const registry = (typeof window !== 'undefined') ?
        window.__msdAnimRegistry?.registry :
        global.__msdAnimRegistry?.registry;

      if (registry) {
        const stats = registry.getStats();
        animations.total = stats.instancesCreated + stats.instancesReused;
        animations.cached = stats.cacheSize;
        animations.reuse_rate = stats.reuseRate;
      }
    } catch (e) {}

    return animations;
  }

  /**
   * Extract comprehensive provenance data
   */
  extractProvenanceData(pipeline) {
    const model = pipeline.getResolvedModel();
    const provenance = model.__provenance || {};

    return {
      merge_order: provenance.merge_order || [],
      anchors: this.summarizeProvenanceSection(provenance.anchors || {}),
      palettes: this.summarizeProvenanceSection(provenance.palettes || {}),
      overlays: this.summarizeProvenanceSection(provenance.overlays || {}),
      rules: this.summarizeProvenanceSection(provenance.rules || {}),
      overrides: this.countOverrides(provenance)
    };
  }

  /**
   * Extract performance data from all systems
   */
  async extractPerformanceData(pipeline) {
    const performance = {
      merge: {},
      rules: {},
      rendering: {},
      routing: {}
    };

    // Get global performance tracker data
    try {
      const perfTracker = (typeof window !== 'undefined') ?
        window.__msdPerf :
        global.__msdPerf;

      if (perfTracker) {
        const data = perfTracker.getAll();
        performance.merge = data.timings;
        performance.session = data.session;
      }
    } catch (e) {}

    // Get rules engine performance
    const rulesEngine = pipeline.getRulesEngine?.();
    if (rulesEngine) {
      const trace = rulesEngine.getTrace();
      performance.rules = trace.evalCounts;
    }

    // Get renderer performance
    const renderer = pipeline.getRenderer?.();
    if (renderer) {
      performance.rendering = renderer.getStats();
    }

    // Get routing cache performance
    try {
      const routingCache = (typeof window !== 'undefined') ?
        window.__msdRoutingCache?.cache :
        global.__msdRoutingCache?.cache;

      if (routingCache) {
        performance.routing = routingCache.getStats();
      }
    } catch (e) {}

    return performance;
  }

  /**
   * Extract rule execution traces
   */
  extractRuleTraces(pipeline) {
    const rulesEngine = pipeline.getRulesEngine?.();
    if (!rulesEngine) return null;

    const traces = rulesEngine.exportTrace({
      format: 'json',
      limit: 100,
      includeConditions: false
    });

    return JSON.parse(traces);
  }

  /**
   * Extract animation statistics
   */
  extractAnimationStats(pipeline) {
    try {
      const registry = (typeof window !== 'undefined') ?
        window.__msdAnimRegistry?.registry :
        global.__msdAnimRegistry?.registry;

      if (registry) {
        return registry.exportStats({ includeCache: true });
      }
    } catch (e) {}

    return null;
  }

  /**
   * Compute comprehensive diff between configurations
   */
  computeComprehensiveDiff(configA, configB) {
    const changes = {
      summary: {
        total_changes: 0,
        additions: 0,
        removals: 0,
        modifications: 0
      },
      sections: {}
    };

    const sections = ['anchors', 'overlays', 'rules', 'animations', 'palettes'];

    sections.forEach(section => {
      const sectionDiff = this.diffSection(
        configA[section],
        configB[section],
        section
      );

      if (sectionDiff.changed) {
        changes.sections[section] = sectionDiff;
        changes.summary.total_changes++;
        changes.summary.additions += sectionDiff.added?.length || 0;
        changes.summary.removals += sectionDiff.removed?.length || 0;
        changes.summary.modifications += sectionDiff.modified?.length || 0;
      }
    });

    return changes;
  }

  /**
   * Diff a configuration section
   */
  diffSection(sectionA, sectionB, sectionName) {
    if (Array.isArray(sectionA) && Array.isArray(sectionB)) {
      return this.diffArray(sectionA, sectionB, 'id');
    } else if (typeof sectionA === 'object' && typeof sectionB === 'object') {
      return this.diffObject(sectionA, sectionB);
    }

    return {
      changed: JSON.stringify(sectionA) !== JSON.stringify(sectionB),
      from: sectionA,
      to: sectionB
    };
  }

  /**
   * Diff arrays by ID field
   */
  diffArray(arrayA, arrayB, idField) {
    const diff = {
      changed: false,
      added: [],
      removed: [],
      modified: []
    };

    const aById = new Map();
    const bById = new Map();

    arrayA.forEach(item => {
      if (item[idField]) aById.set(item[idField], item);
    });

    arrayB.forEach(item => {
      if (item[idField]) bById.set(item[idField], item);
    });

    // Find added
    bById.forEach((item, id) => {
      if (!aById.has(id)) {
        diff.added.push(item);
        diff.changed = true;
      }
    });

    // Find removed and modified
    aById.forEach((itemA, id) => {
      if (!bById.has(id)) {
        diff.removed.push(itemA);
        diff.changed = true;
      } else {
        const itemB = bById.get(id);
        if (JSON.stringify(itemA) !== JSON.stringify(itemB)) {
          diff.modified.push({ id, from: itemA, to: itemB });
          diff.changed = true;
        }
      }
    });

    return diff;
  }

  /**
   * Diff objects by keys
   */
  diffObject(objA, objB) {
    const diff = {
      changed: false,
      added: {},
      removed: {},
      modified: {}
    };

    const allKeys = new Set([
      ...Object.keys(objA || {}),
      ...Object.keys(objB || {})
    ]);

    allKeys.forEach(key => {
      const valueA = objA?.[key];
      const valueB = objB?.[key];

      if (valueA === undefined && valueB !== undefined) {
        diff.added[key] = valueB;
        diff.changed = true;
      } else if (valueA !== undefined && valueB === undefined) {
        diff.removed[key] = valueA;
        diff.changed = true;
      } else if (JSON.stringify(valueA) !== JSON.stringify(valueB)) {
        diff.modified[key] = { from: valueA, to: valueB };
        diff.changed = true;
      }
    });

    return diff;
  }

  /**
   * Analyze performance health
   */
  analyzePerformanceHealth(pipeline) {
    const health = {
      status: 'good',
      issues: [],
      metrics: {}
    };

    try {
      const perfTracker = (typeof window !== 'undefined') ?
        window.__msdPerf :
        global.__msdPerf;

      if (perfTracker) {
        const summary = perfTracker.getSummary();
        health.metrics = summary;

        // Check for performance issues
        if (summary.timings['merge.total']?.avg > 100) {
          health.issues.push('Merge performance degraded (>100ms average)');
          health.status = 'warning';
        }

        if (summary.health === 'critical') {
          health.status = 'critical';
        }
      }
    } catch (e) {}

    return health;
  }

  /**
   * Analyze memory health
   */
  analyzeMemoryHealth(pipeline) {
    return {
      status: 'good', // Would implement actual memory monitoring
      heap_used: 0,
      issues: []
    };
  }

  /**
   * Analyze cache health across all systems
   */
  analyzeCacheHealth(pipeline) {
    const health = {
      status: 'good',
      systems: {},
      total_hit_rate: 0
    };

    const systems = ['animation', 'routing', 'profile', 'valuemap'];
    let totalHitRate = 0;
    let validSystems = 0;

    systems.forEach(system => {
      try {
        const cache = (typeof window !== 'undefined') ?
          window[`__msd${system.charAt(0).toUpperCase()}${system.slice(1)}`] :
          global[`__msd${system.charAt(0).toUpperCase()}${system.slice(1)}`];

        if (cache) {
          const stats = cache.getStats?.() || cache.resolver?.getStats?.();
          if (stats && typeof stats.hitRate === 'number') {
            health.systems[system] = {
              hit_rate: stats.hitRate,
              cache_size: stats.cacheSize || 0
            };
            totalHitRate += stats.hitRate;
            validSystems++;
          }
        }
      } catch (e) {}
    });

    if (validSystems > 0) {
      health.total_hit_rate = totalHitRate / validSystems;
    }

    return health;
  }

  /**
   * Analyze rules engine health
   */
  analyzeRulesHealth(pipeline) {
    const health = {
      status: 'good',
      rules_count: 0,
      evaluation_rate: 0,
      issues: []
    };

    const rulesEngine = pipeline.getRulesEngine?.();
    if (rulesEngine) {
      const trace = rulesEngine.getTrace();
      health.rules_count = trace.totalRules;
      health.evaluation_rate = trace.evalCounts?.total || 0;

      // Check for issues
      if (trace.evalCounts?.total > 10000) {
        health.issues.push('High rule evaluation count may indicate performance issues');
        health.status = 'warning';
      }
    }

    return health;
  }

  /**
   * Analyze animation system health
   */
  analyzeAnimationHealth(pipeline) {
    const health = {
      status: 'good',
      reuse_rate: 0,
      issues: []
    };

    try {
      const registry = (typeof window !== 'undefined') ?
        window.__msdAnimRegistry?.registry :
        global.__msdAnimRegistry?.registry;

      if (registry) {
        const stats = registry.getStats();
        health.reuse_rate = stats.reuseRate;

        if (stats.reuseRate < 0.3) {
          health.issues.push('Low animation reuse rate (<30%)');
          health.status = 'warning';
        }
      }
    } catch (e) {}

    return health;
  }

  /**
   * Compute overall system health
   */
  computeOverallHealth(report) {
    const systems = [
      report.performance.status,
      report.memory.status,
      report.cache.status,
      report.rules.status,
      report.animations.status
    ];

    if (systems.some(status => status === 'critical')) return 'critical';
    if (systems.some(status => status === 'warning')) return 'warning';
    return 'healthy';
  }

  /**
   * Summarize provenance section
   */
  summarizeProvenanceSection(section) {
    const summary = {
      total_items: Object.keys(section).length,
      overridden: 0,
      by_origin: {}
    };

    Object.values(section).forEach(item => {
      if (item.overridden) {
        summary.overridden++;
      }

      const origin = item.origin_pack || 'unknown';
      summary.by_origin[origin] = (summary.by_origin[origin] || 0) + 1;
    });

    return summary;
  }

  /**
   * Count overrides across all provenance data
   */
  countOverrides(provenance) {
    let total = 0;

    Object.values(provenance).forEach(section => {
      if (typeof section === 'object') {
        Object.values(section).forEach(item => {
          if (item?.overridden) total++;
        });
      }
    });

    return total;
  }

  /**
   * Strip metadata from configuration object
   */
  stripMetadata(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.stripMetadata(item));
    }

    const cleaned = {};
    Object.entries(obj).forEach(([key, value]) => {
      // Skip metadata fields
      if (!key.startsWith('__') && !['checksum', 'origin_pack', '_styleSources'].includes(key)) {
        cleaned[key] = this.stripMetadata(value);
      }
    });

    return cleaned;
  }

  /**
   * Format snapshot for output
   */
  formatSnapshot(snapshot, format, compress) {
    if (format === 'yaml') {
      return this.convertToYaml(snapshot);
    }

    const json = JSON.stringify(snapshot, null, compress ? 0 : 2);

    if (compress) {
      // Could implement compression here
    }

    return json;
  }

  /**
   * Format diff for output
   */
  formatDiff(diff, format) {
    if (format === 'yaml') {
      return this.convertToYaml(diff);
    }

    return JSON.stringify(diff, null, 2);
  }

  /**
   * Convert object to YAML (simplified)
   */
  convertToYaml(obj) {
    // Simplified YAML conversion for now
    return `# Generated YAML Export\n${JSON.stringify(obj, null, 2)}`;
  }

  /**
   * Record export in history
   */
  recordExport(meta, options) {
    this.exportHistory.unshift({
      timestamp: meta.timestamp,
      format: meta.export_format,
      options: meta.options
    });

    // Limit history size
    if (this.exportHistory.length > this.maxHistorySize) {
      this.exportHistory = this.exportHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get export history
   */
  getExportHistory() {
    return [...this.exportHistory];
  }
}

// Global export completion instance
const globalExportCompletion = new ExportCompletion();

// Debug exposure
const debugNamespace = (typeof window !== 'undefined') ? window : global;
if (debugNamespace) {
  debugNamespace.__msdExportCompletion = {
    exporter: globalExportCompletion,
    exportFullSnapshot: (pipeline, options) => globalExportCompletion.exportFullSnapshot(pipeline, options),
    exportConfigDiff: (a, b, options) => globalExportCompletion.exportConfigDiff(a, b, options),
    exportHealthReport: (pipeline, options) => globalExportCompletion.exportHealthReport(pipeline, options),
    getExportHistory: () => globalExportCompletion.getExportHistory()
  };
}

export { globalExportCompletion };
