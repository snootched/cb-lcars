/**
 * Performance monitoring panel for MSD HUD
 * Displays timer and counter data with formatting
 */

export class PerformancePanel {
  captureData() {
    const timers = {};
    const counters = {};

    try {
      const perfData = window.__msdDebug?.getPerf?.() || {};

      if (perfData.timers) {
        Object.entries(perfData.timers).forEach(([key, data]) => {
          timers[key] = {
            count: data.count || 0,
            total: data.total || 0,
            avg: data.count > 0 ? (data.total / data.count) : 0,
            last: data.last || 0,
            max: data.max || 0
          };
        });
      }

      if (perfData.counters) {
        Object.entries(perfData.counters).forEach(([key, value]) => {
          counters[key] = Number(value) || 0;
        });
      }
    } catch (_) {}

    return { timers, counters };
  }

  renderHtml(performance) {
    let html = '<div class="msd-hud-panel"><h3>Performance</h3>';

    // Timers section
    const timers = Object.entries(performance.timers || {}).slice(0, 8);
    if (timers.length > 0) {
      html += '<div class="msd-hud-section"><h4>Timers</h4>';
      timers.forEach(([key, data]) => {
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">${key}</span>
          <span class="msd-hud-metric-value">${data.avg.toFixed(2)}ms avg</span>
        </div>`;
      });
      html += '</div>';
    }

    // Counters section
    const counters = Object.entries(performance.counters || {}).slice(0, 8);
    if (counters.length > 0) {
      html += '<div class="msd-hud-section"><h4>Counters</h4>';
      counters.forEach(([key, value]) => {
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">${key}</span>
          <span class="msd-hud-metric-value">${value}</span>
        </div>`;
      });
      html += '</div>';
    }

    if (timers.length === 0 && counters.length === 0) {
      html += '<div class="msd-hud-section">No performance data available</div>';
    }

    html += '</div>';
    return html;
  }
}
