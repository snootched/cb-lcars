/**
 * Enhanced Performance monitoring panel for MSD HUD
 * Timer and counter data with threshold alerts and reset functionality
 */

export class PerformancePanel {
  constructor() {
    this.thresholds = new Map(); // timerId -> threshold config
    this.previousSnapshot = {};
  }

  // Instance methods replacing global panel handlers
  setThreshold(timerId, avgMs) {
    const t = parseFloat(avgMs);
    if (isNaN(t)) this.thresholds.delete(timerId);
    else this.thresholds.set(timerId, { avgMs: t });
  }
  resetTimer(timerId) {
    try { window.__msdDebug?.getPerf?.()?.resetTimer?.(timerId); } catch {}
  }
  clearAllTimers() {
    try { window.__msdDebug?.getPerf?.()?.clear?.(); } catch {}
    this.thresholds.clear();
  }
  exportData() {
    const perfData = window.__msdDebug?.getPerf?.() || {};
    const data = {
      timestamp: Date.now(),
      timers: perfData.timers || {},
      counters: perfData.counters || {},
      thresholds: Object.fromEntries(this.thresholds)
    };

    console.table(data.timers);
    console.log('[PerformancePanel] Performance data:', data);

    // Create downloadable export
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `msd-performance-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  captureData() {
    const timers = {};
    const counters = {};
    const alerts = [];
    const regressions = [];

    try {
      // FIXED: Use centralized debug status access for performance state
      const debugStatus = window.__msdDebug?.getDebugStatusSilent?.() || {};

      // Get performance data using consistent approach
      const perfData = window.__msdDebug?.getPerf?.() || {};

      // Process timers
      if (perfData.timers) {
        Object.entries(perfData.timers).forEach(([key, data]) => {
          const timerData = {
            count: data.count || 0,
            total: data.total || 0,
            avg: data.count > 0 ? (data.total / data.count) : 0,
            last: data.last || 0,
            max: data.max || 0,
            min: data.min || 0
          };

          timers[key] = timerData;

          // Check thresholds
          const threshold = this.thresholds.get(key);
          if (threshold && timerData.avg > threshold.avgMs) {
            alerts.push({
              type: 'threshold',
              timer: key,
              current: timerData.avg,
              threshold: threshold.avgMs,
              severity: timerData.avg > threshold.avgMs * 2 ? 'high' : 'medium'
            });
          }

          // Check for regressions
          const previous = this.previousSnapshot[key];
          if (previous && previous.avg > 0) {
            const regression = ((timerData.avg - previous.avg) / previous.avg) * 100;
            if (regression > 20) { // >20% increase
              regressions.push({
                timer: key,
                previousAvg: previous.avg,
                currentAvg: timerData.avg,
                regression: regression
              });
            }
          }
        });
      }

      // Process counters
      if (perfData.counters) {
        Object.entries(perfData.counters).forEach(([key, value]) => {
          counters[key] = Number(value) || 0;
        });
      }

      // Store snapshot for regression detection
      this.previousSnapshot = { ...timers };

    } catch (e) {
      console.warn('[PerformancePanel] Data capture failed:', e);
    }

    return { timers, counters, alerts, regressions };
  }

  renderHtml(performance) {
    let html = '<div class="msd-hud-panel"><h3>Performance Monitor</h3>';

    const { timers, counters, alerts, regressions } = performance;

    // Controls section
    html += '<div class="msd-hud-section"><h4>Controls</h4>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';

    html += `<button data-bus-event="performance:clear-all" onclick="__msdHudBus('performance:clear-all')"
      style="font-size:10px;padding:2px 6px;background:#666;color:#fff;border:1px solid #888;border-radius:3px;cursor:pointer;">
      Clear All
    </button>`;

    html += `<button data-bus-event="performance:export" onclick="__msdHudBus('performance:export')"
      style="font-size:10px;padding:2px 6px;background:#333;color:#fff;border:1px solid #555;border-radius:3px;cursor:pointer;">
      Export
    </button>`;

    html += '</div></div>';

    // Alerts section
    if (alerts && alerts.length > 0) {
      html += '<div class="msd-hud-section msd-hud-warning"><h4>Threshold Alerts</h4>';
      alerts.forEach(alert => {
        const severityColor = alert.severity === 'high' ? '#ff4444' : '#ffaa00';
        html += `<div class="msd-hud-metric msd-hud-warning">
          <span class="msd-hud-metric-name" style="color:${severityColor};">${alert.timer}</span>
          <span class="msd-hud-metric-value">${alert.current.toFixed(2)}ms > ${alert.threshold}ms</span>
        </div>`;
      });
      html += '</div>';
    }

    // Regressions section
    if (regressions && regressions.length > 0) {
      html += '<div class="msd-hud-section msd-hud-error"><h4>Performance Regressions</h4>';
      regressions.forEach(regression => {
        html += `<div class="msd-hud-metric msd-hud-error">
          <span class="msd-hud-metric-name">${regression.timer}</span>
          <span class="msd-hud-metric-value">+${regression.regression.toFixed(1)}%</span>
        </div>`;
        html += `<div class="msd-hud-metric-detail">
          ${regression.previousAvg.toFixed(2)}ms → ${regression.currentAvg.toFixed(2)}ms
        </div>`;
      });
      html += '</div>';
    }

    // Timers section
    const timerEntries = Object.entries(timers || {}).slice(0, 10);
    if (timerEntries.length > 0) {
      html += '<div class="msd-hud-section"><h4>Timers</h4>';

      // Sort by average time descending
      timerEntries.sort(([,a], [,b]) => b.avg - a.avg);

      timerEntries.forEach(([key, data]) => {
        const hasThreshold = this.thresholds.has(key);
        const threshold = this.thresholds.get(key);
        const isOverThreshold = hasThreshold && data.avg > threshold.avgMs;
        const avgColor = isOverThreshold ? '#ff6666' : data.avg > 10 ? '#ffaa00' : '#66ff99';

        html += `<div class="msd-hud-metric" style="margin:4px 0;padding:4px;border:1px solid #333;border-radius:3px;">
          <div style="display:flex;justify-content:space-between;">
            <span class="msd-hud-metric-name">${key}</span>
            <span class="msd-hud-metric-value" style="color:${avgColor};">${data.avg.toFixed(2)}ms</span>
          </div>
          <div style="font-size:10px;color:#888;margin-top:2px;">
            Count: ${data.count} • Max: ${data.max.toFixed(1)}ms • Last: ${data.last.toFixed(1)}ms
          </div>
          <div style="display:flex;gap:4px;margin-top:4px;">
            <input type="number" placeholder="Threshold (ms)" value="${hasThreshold ? threshold.avgMs : ''}"
              id="perf-threshold-${key.replace(/[^a-z0-9_-]/gi,'-')}"
              name="perf-threshold-${key.replace(/[^a-z0-9_-]/gi,'-')}"
              data-bus-event="performance:set-threshold" data-timer="${key}"
              onchange="__msdHudBus('performance:set-threshold',{timer:'${key}',value:this.value})"
              style="width:80px;font-size:9px;padding:1px 3px;">
            <button data-bus-event="performance:reset-timer"
              onclick="__msdHudBus('performance:reset-timer',{timer:'${key}'})"
              style="font-size:9px;padding:1px 4px;background:#555;color:#fff;border:1px solid #777;border-radius:2px;cursor:pointer;">
              Reset
            </button>
          </div>
        </div>`;
      });
      html += '</div>';
    }

    // Counters section
    const counterEntries = Object.entries(counters || {}).slice(0, 8);
    if (counterEntries.length > 0) {
      html += '<div class="msd-hud-section"><h4>Counters</h4>';
      counterEntries.forEach(([key, value]) => {
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">${key}</span>
          <span class="msd-hud-metric-value">${value}</span>
        </div>`;
      });
      html += '</div>';
    }

    if (timerEntries.length === 0 && counterEntries.length === 0) {
      html += '<div class="msd-hud-section">No performance data available</div>';
    }

    // Summary
    const alertCount = alerts?.length || 0;
    const regressionCount = regressions?.length || 0;
    html += `<div class="msd-hud-section msd-hud-summary">
      ${timerEntries.length} timers • ${counterEntries.length} counters
      ${alertCount > 0 ? ` • ${alertCount} alerts` : ''}
      ${regressionCount > 0 ? ` • ${regressionCount} regressions` : ''}
    </div>`;

    html += '</div>';
    return html;
  }
}
