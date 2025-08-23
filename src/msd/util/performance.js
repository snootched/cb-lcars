/**
 * Performance tracking and instrumentation for MSD pipeline
 * Provides detailed timing and counter metrics for optimization
 */

class PerformanceTracker {
  constructor() {
    this.counters = new Map();
    this.timings = new Map();
    this.sessionStart = performance.now();
  }

  /**
   * Add timing measurement
   */
  addTiming(key, ms, metadata = {}) {
    if (!this.timings.has(key)) {
      this.timings.set(key, {
        last: 0,
        totalMs: 0,
        samples: 0,
        avg: 0,
        min: Infinity,
        max: 0,
        metadata: []
      });
    }

    const timing = this.timings.get(key);
    timing.last = ms;
    timing.totalMs += ms;
    timing.samples++;
    timing.avg = timing.totalMs / timing.samples;
    timing.min = Math.min(timing.min, ms);
    timing.max = Math.max(timing.max, ms);

    if (Object.keys(metadata).length > 0) {
      timing.metadata.push({ ...metadata, ms, timestamp: Date.now() });
      // Keep only last 10 metadata entries
      if (timing.metadata.length > 10) {
        timing.metadata = timing.metadata.slice(-10);
      }
    }
  }

  /**
   * Add discrete counter
   */
  addCount(key, increment = 1, metadata = {}) {
    if (!this.counters.has(key)) {
      this.counters.set(key, {
        count: 0,
        rate: 0,
        lastUpdate: performance.now(),
        metadata: []
      });
    }

    const counter = this.counters.get(key);
    const now = performance.now();
    const deltaTime = (now - counter.lastUpdate) / 1000; // seconds

    counter.count += increment;
    counter.rate = deltaTime > 0 ? increment / deltaTime : 0;
    counter.lastUpdate = now;

    if (Object.keys(metadata).length > 0) {
      counter.metadata.push({ ...metadata, increment, timestamp: Date.now() });
      // Keep only last 10 metadata entries
      if (counter.metadata.length > 10) {
        counter.metadata = counter.metadata.slice(-10);
      }
    }
  }

  /**
   * Time a function execution
   */
  async timeAsync(key, fn, metadata = {}) {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.addTiming(key, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.addTiming(key, duration, { ...metadata, error: error.message });
      throw error;
    }
  }

  /**
   * Time a synchronous function execution
   */
  timeSync(key, fn, metadata = {}) {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.addTiming(key, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.addTiming(key, duration, { ...metadata, error: error.message });
      throw error;
    }
  }

  /**
   * Get all performance data
   */
  getAll() {
    const sessionDuration = performance.now() - this.sessionStart;

    return {
      session: {
        duration_ms: sessionDuration,
        started_at: Date.now() - sessionDuration
      },
      timings: Object.fromEntries(this.timings),
      counters: Object.fromEntries(this.counters),
      summary: this.getSummary()
    };
  }

  /**
   * Get performance summary for quick overview
   */
  getSummary() {
    const criticalTimings = ['merge.total', 'validation.total', 'render.total'];
    const criticalCounters = ['rules.eval.count', 'rules.match.count', 'animation.instance.reuse'];

    const summary = {
      timings: {},
      counters: {},
      health: 'good'
    };

    // Extract critical timing data
    criticalTimings.forEach(key => {
      if (this.timings.has(key)) {
        const timing = this.timings.get(key);
        summary.timings[key] = {
          avg: timing.avg,
          last: timing.last,
          samples: timing.samples
        };

        // Health check: mark as warning if average is high
        if (timing.avg > 50) { // 50ms threshold
          summary.health = 'warning';
        }
        if (timing.avg > 100) { // 100ms threshold
          summary.health = 'critical';
        }
      }
    });

    // Extract critical counter data
    criticalCounters.forEach(key => {
      if (this.counters.has(key)) {
        const counter = this.counters.get(key);
        summary.counters[key] = {
          count: counter.count,
          rate: counter.rate
        };
      }
    });

    return summary;
  }

  /**
   * Reset all performance data
   */
  reset() {
    this.counters.clear();
    this.timings.clear();
    this.sessionStart = performance.now();
  }

  /**
   * Export performance data for analysis
   */
  export(options = {}) {
    const data = this.getAll();

    if (options.format === 'csv') {
      return this.exportToCsv(data);
    }

    if (options.minify) {
      return this.minifyData(data);
    }

    return data;
  }

  minifyData(data) {
    // Remove metadata and keep only essential metrics
    const minified = {
      session: data.session,
      timings: {},
      counters: {},
      summary: data.summary
    };

    for (const [key, timing] of Object.entries(data.timings)) {
      minified.timings[key] = {
        avg: timing.avg,
        last: timing.last,
        samples: timing.samples,
        min: timing.min,
        max: timing.max
      };
    }

    for (const [key, counter] of Object.entries(data.counters)) {
      minified.counters[key] = {
        count: counter.count,
        rate: counter.rate
      };
    }

    return minified;
  }
}

// Global instance
const globalPerfTracker = new PerformanceTracker();

// Utility functions for common operations
export function perfTime(key, fn, metadata = {}) {
  if (typeof fn === 'function') {
    return globalPerfTracker.timeSync(key, fn, metadata);
  }
  // Return timing function for manual timing
  return {
    end: (metadata = {}) => {
      const duration = performance.now() - perfTime.start;
      globalPerfTracker.addTiming(key, duration, metadata);
    }
  };
}

export async function perfTimeAsync(key, fn, metadata = {}) {
  return globalPerfTracker.timeAsync(key, fn, metadata);
}

export function perfCount(key, increment = 1, metadata = {}) {
  globalPerfTracker.addCount(key, increment, metadata);
}

export function perfGetAll() {
  return globalPerfTracker.getAll();
}

export function perfGetSummary() {
  return globalPerfTracker.getSummary();
}

export function perfReset() {
  globalPerfTracker.reset();
}

export function perfExport(options = {}) {
  return globalPerfTracker.export(options);
}

// Node.js and browser compatibility
const debugNamespace = (typeof window !== 'undefined') ? window : global;
if (debugNamespace) {
  debugNamespace.__msdPerf = {
    getAll: perfGetAll,
    getSummary: perfGetSummary,
    reset: perfReset,
    export: perfExport
  };
}
