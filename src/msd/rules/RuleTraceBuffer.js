/**
 * Ring buffer for rule evaluation traces
 * Provides debugging capabilities and HUD integration
 */

export class RuleTraceBuffer {
  constructor(maxSize = 1000) {
    this.buffer = [];
    this.maxSize = maxSize;
    this.index = 0;
    this.totalTraces = 0;
  }

  addTrace(ruleId, matched, conditions, evaluationTime, metadata = {}) {
    const trace = {
      ruleId,
      matched,
      conditions,
      evaluationTime,
      timestamp: Date.now(),
      metadata: { ...metadata }
    };

    if (this.buffer.length < this.maxSize) {
      this.buffer.push(trace);
    } else {
      this.buffer[this.index] = trace;
      this.index = (this.index + 1) % this.maxSize;
    }

    this.totalTraces++;
  }

  getRecentTraces(limit = 50, filter = {}) {
    const recent = [];
    let idx = this.index - 1;

    for (let i = 0; i < Math.min(limit, this.buffer.length); i++) {
      if (idx < 0) idx = this.buffer.length - 1;

      const trace = this.buffer[idx];
      if (this.matchesFilter(trace, filter)) {
        recent.unshift(trace);
      }

      idx--;
    }

    return recent;
  }

  getRuleHistory(ruleId, limit = 20) {
    return this.getRecentTraces(this.buffer.length, { ruleId }).slice(0, limit);
  }

  getMatchedRules(timeWindow = 60000, limit = 100) {
    const cutoff = Date.now() - timeWindow;
    return this.getRecentTraces(this.buffer.length, { matched: true })
      .filter(trace => trace.timestamp > cutoff)
      .slice(0, limit);
  }

  getStats() {
    const recent = this.getRecentTraces(this.buffer.length);
    const matched = recent.filter(t => t.matched).length;
    const avgEvalTime = recent.length > 0
      ? recent.reduce((sum, t) => sum + t.evaluationTime, 0) / recent.length
      : 0;

    return {
      totalTraces: this.totalTraces,
      bufferedTraces: this.buffer.length,
      recentMatched: matched,
      recentTotal: recent.length,
      matchRate: recent.length > 0 ? matched / recent.length : 0,
      avgEvaluationTime: avgEvalTime
    };
  }

  matchesFilter(trace, filter) {
    if (filter.ruleId && trace.ruleId !== filter.ruleId) return false;
    if (filter.matched !== undefined && trace.matched !== filter.matched) return false;
    if (filter.minTime && trace.timestamp < filter.minTime) return false;
    if (filter.maxTime && trace.timestamp > filter.maxTime) return false;
    if (filter.minEvalTime && trace.evaluationTime < filter.minEvalTime) return false;

    return true;
  }

  clear() {
    this.buffer = [];
    this.index = 0;
    this.totalTraces = 0;
  }

  exportTraces(options = {}) {
    const {
      format = 'json',
      limit = 100,
      includeConditions = true,
      includeMetadata = false
    } = options;

    const traces = this.getRecentTraces(limit);

    const exported = traces.map(trace => {
      const exported = {
        ruleId: trace.ruleId,
        matched: trace.matched,
        evaluationTime: trace.evaluationTime,
        timestamp: trace.timestamp
      };

      if (includeConditions) {
        exported.conditions = trace.conditions;
      }

      if (includeMetadata) {
        exported.metadata = trace.metadata;
      }

      return exported;
    });

    if (format === 'csv') {
      return this.exportToCsv(exported);
    }

    return JSON.stringify(exported, null, 2);
  }

  exportToCsv(traces) {
    if (traces.length === 0) return 'No traces available\n';

    const headers = ['ruleId', 'matched', 'evaluationTime', 'timestamp'];
    const rows = traces.map(trace => [
      trace.ruleId,
      trace.matched,
      trace.evaluationTime.toFixed(3),
      new Date(trace.timestamp).toISOString()
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }
}

// Global trace buffer instance
const globalTraceBuffer = new RuleTraceBuffer();

// Node.js and browser compatibility
const debugNamespace = (typeof window !== 'undefined') ? window : global;
if (debugNamespace) {
  debugNamespace.__msdRuleTrace = {
    buffer: globalTraceBuffer,
    getRecent: (limit) => globalTraceBuffer.getRecentTraces(limit),
    getStats: () => globalTraceBuffer.getStats(),
    getRuleHistory: (ruleId) => globalTraceBuffer.getRuleHistory(ruleId),
    export: (options) => globalTraceBuffer.exportTraces(options),
    clear: () => globalTraceBuffer.clear()
  };
}

export { globalTraceBuffer };
