/**
 * Phase 3: Development HUD manager
 * Provides performance monitoring and development tools
 */

export class MsdHudManager {
  constructor() {
    this.state = {
      visible: false,
      collapsed: false,
      position: null,
      interval: 3000
    };
    this.refreshTimer = null;
    this.lastSnapshot = null;
    this.panels = new Map();

    // Initialize basic panels
    this.initializePanels();
  }

  initializePanels() {
    // Basic panel structure - can be enhanced later with dedicated panel classes
    this.panels.set('performance', {
      captureData: () => this.capturePerformanceData(),
      renderHtml: (data) => this.buildPerformancePanelHtml(data)
    });

    this.panels.set('validation', {
      captureData: () => this.captureValidationData(),
      renderHtml: (data) => this.buildValidationPanelHtml(data)
    });

    this.panels.set('routing', {
      captureData: (resolvedModel) => this.captureRoutingData(resolvedModel),
      renderHtml: (data) => this.buildRoutingPanelHtml(data)
    });
  }

  show() {
    this.state.visible = true;
    this.loadPersistedState();
    this.ensureMounted();
    this.startRefreshLoop();

    // Immediate refresh
    this.refresh();
  }

  hide() {
    this.state.visible = false;
    this.stopRefreshLoop();
    const mount = this.getMount();
    if (mount) mount.style.display = 'none';
  }

  toggle() {
    this.state.visible ? this.hide() : this.show();
  }

  refresh() {
    if (!this.state.visible) return;

    const snapshot = this.buildSnapshot();
    if (snapshot) {
      this.lastSnapshot = snapshot;
      this.renderPanels(snapshot);
    }
  }

  buildSnapshot() {
    // Handle case where pipeline isn't available - still return valid snapshot
    const pipelineInstance = (typeof window !== 'undefined')
      ? window.__msdDebug?.pipelineInstance
      : global.window?.__msdDebug?.pipelineInstance;

    // Always create a valid snapshot structure, even without pipeline
    const timestamp = Date.now();
    const snapshot = {
      timestamp,
      timestampIso: new Date(timestamp).toISOString(),

      // Capture data from all panels - they handle missing data gracefully
      performance: this.panels.get('performance')?.captureData() || { timers: {}, counters: {} },
      validation: this.panels.get('validation')?.captureData() || { issues: [], count: 0 },
      routing: this.panels.get('routing')?.captureData() || { routes: [], count: 0 },

      // Pipeline state summary - handle missing pipeline
      pipeline: {
        overlayCount: 0,
        anchorCount: 0,
        ruleCount: 0
      }
    };

    // If pipeline is available, get real data
    if (pipelineInstance) {
      const resolvedModel = pipelineInstance.getResolvedModel?.();
      if (resolvedModel) {
        snapshot.pipeline = {
          overlayCount: resolvedModel.overlays?.length || 0,
          anchorCount: Object.keys(resolvedModel.anchors || {}).length,
          ruleCount: resolvedModel.rules?.length || 0
        };

        // Update routing data with resolved model
        snapshot.routing = this.panels.get('routing')?.captureData(resolvedModel) || { routes: [], count: 0 };
      }
    }

    return snapshot;
  }

  capturePerformanceData() {
    // Performance timer and counter collection
    const data = { timers: {}, counters: {} };

    try {
      const getPerfFunc = (typeof window !== 'undefined')
        ? window.__msdDebug?.getPerf
        : global.window?.__msdDebug?.getPerf;

      const perfData = getPerfFunc?.() || {};

      if (perfData.timers) {
        Object.entries(perfData.timers).forEach(([key, timerData]) => {
          data.timers[key] = {
            count: timerData.count || 0,
            total: timerData.total || 0,
            avg: timerData.count > 0 ? (timerData.total / timerData.count) : 0,
            last: timerData.last || 0,
            max: timerData.max || 0
          };
        });
      }

      if (perfData.counters) {
        Object.entries(perfData.counters).forEach(([key, value]) => {
          data.counters[key] = Number(value) || 0;
        });
      }
    } catch (_) {}

    return data;
  }

  captureValidationData() {
    // Validation issue collection
    const issues = [];

    try {
      const getIssuesFunc = (typeof window !== 'undefined')
        ? window.__msdDebug?.validation?.issues
        : global.window?.__msdDebug?.validation?.issues;

      const validation = getIssuesFunc?.() || [];
      validation.forEach(issue => {
        issues.push({
          severity: issue.severity || 'error',
          message: issue.message || String(issue),
          code: issue.code || null
        });
      });
    } catch (_) {}

    return { issues, count: issues.length };
  }

  captureRoutingData(resolvedModel) {
    // Basic routing inspection
    const routes = [];

    try {
      const lineOverlays = resolvedModel?.overlays?.filter(o => o.type === 'line') || [];

      for (const overlay of lineOverlays.slice(0, 10)) { // Limit to prevent UI bloat
        const inspectFunc = (typeof window !== 'undefined')
          ? window.__msdDebug?.routing?.inspect
          : global.window?.__msdDebug?.routing?.inspect;

        const routeInfo = inspectFunc?.(overlay.id);
        if (routeInfo) {
          routes.push({
            id: overlay.id,
            strategy: routeInfo.meta?.strategy || 'unknown',
            cost: routeInfo.meta?.cost || 0,
            success: routeInfo.meta?.success !== false
          });
        }
      }
    } catch (_) {}

    return { routes, count: routes.length };
  }

  renderPanels(snapshot) {
    const mount = this.getMount();
    if (!mount) return;

    // Build complete HTML from all panels
    let html = this.buildHeaderHtml(snapshot);

    for (const [name, panel] of this.panels) {
      html += panel.renderHtml(snapshot[name] || {});
    }

    mount.innerHTML = html;
    mount.style.display = 'block';
  }

  buildHeaderHtml(snapshot) {
    const hideFunc = (typeof window !== 'undefined')
      ? 'window.__msdDebug?.hud?.hide?.()'
      : 'global.window.__msdDebug?.hud?.hide?.()';

    return `
      <div class="msd-hud-header">
        <span class="msd-hud-title">MSD v1 HUD</span>
        <span class="msd-hud-timestamp">${new Date(snapshot.timestamp).toLocaleTimeString()}</span>
        <button onclick="${hideFunc}">×</button>
      </div>
    `;
  }

  buildPerformancePanelHtml(performance) {
    let html = '<div class="msd-hud-panel"><h3>Performance</h3>';

    // Timers
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

    // Counters
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

    html += '</div>';
    return html;
  }

  buildValidationPanelHtml(validation) {
    let html = '<div class="msd-hud-panel"><h3>Validation</h3>';

    if (validation.count === 0) {
      html += '<div class="msd-hud-success">✓ No issues found</div>';
    } else {
      validation.issues.slice(0, 5).forEach(issue => {
        const cssClass = issue.severity === 'warning' ? 'msd-hud-warning' : 'msd-hud-error';
        html += `<div class="${cssClass}">${issue.message}</div>`;
      });

      if (validation.issues.length > 5) {
        html += `<div class="msd-hud-metric">
          <span>... and ${validation.issues.length - 5} more</span>
        </div>`;
      }
    }

    html += '</div>';
    return html;
  }

  buildRoutingPanelHtml(routing) {
    let html = '<div class="msd-hud-panel"><h3>Routing</h3>';

    if (routing.count === 0) {
      html += '<div>No routes found</div>';
    } else {
      routing.routes.slice(0, 5).forEach(route => {
        const statusClass = route.success ? 'msd-hud-success' : 'msd-hud-failed';
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">${route.id}</span>
          <span class="${statusClass}">${route.strategy} (${route.cost})</span>
        </div>`;
      });

      if (routing.routes.length > 5) {
        html += `<div class="msd-hud-metric">
          <span>... and ${routing.routes.length - 5} more routes</span>
        </div>`;
      }
    }

    html += '</div>';
    return html;
  }

  startRefreshLoop() {
    this.stopRefreshLoop();

    // Ensure refresh loop works in both browser and Node.js environments
    const refreshFunction = () => {
      if (this.state.visible) {
        this.refresh();
      }
    };

    // Use appropriate timer for environment - ensure immediate first call
    if (typeof setInterval !== 'undefined') {
      // Call immediately first for testing
      setTimeout(() => refreshFunction(), 0);
      this.refreshTimer = setInterval(refreshFunction, this.state.interval);
    } else {
      // Node.js fallback - use setTimeout chain with immediate first call
      const scheduleNext = () => {
        refreshFunction(); // Call immediately
        this.refreshTimer = setTimeout(() => {
          if (this.refreshTimer) { // Only schedule next if not stopped
            scheduleNext();
          }
        }, this.state.interval);
      };
      scheduleNext();
    }
  }

  stopRefreshLoop() {
    if (this.refreshTimer) {
      if (typeof clearInterval !== 'undefined') {
        clearInterval(this.refreshTimer);
      } else {
        clearTimeout(this.refreshTimer);
      }
      this.refreshTimer = null;
    }
  }

  getMount() {
    const doc = (typeof document !== 'undefined') ? document : global.document;
    if (!doc) return null;

    return doc.querySelector('#msd-hud-root') || this.createMount();
  }

  createMount() {
    const doc = (typeof document !== 'undefined') ? document : global.document;
    if (!doc) return null;

    const mount = doc.createElement('div');
    mount.id = 'msd-hud-root';
    mount.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 2147480000;
      background: rgba(20, 0, 40, 0.95); border: 1px solid #ff00ff;
      border-radius: 8px; color: #ffffff; font-family: monospace;
      font-size: 11px; min-width: 280px; max-width: 400px; max-height: 80vh;
      overflow-y: auto; display: none;
    `;

    // Add panel styling
    const style = doc.createElement('style');
    style.textContent = `
      .msd-hud-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px 12px; border-bottom: 1px solid #ff00ff;
        background: rgba(255, 0, 255, 0.1);
      }
      .msd-hud-title { font-weight: bold; }
      .msd-hud-timestamp { font-size: 10px; opacity: 0.8; }
      .msd-hud-panel {
        padding: 8px 12px; border-bottom: 1px solid rgba(255,0,255,0.3);
      }
      .msd-hud-panel:last-child { border-bottom: none; }
      .msd-hud-panel h3 {
        margin: 0 0 8px 0; font-size: 12px; color: #ff00ff;
      }
      .msd-hud-section { margin-bottom: 8px; }
      .msd-hud-section h4 {
        margin: 0 0 4px 0; font-size: 11px; opacity: 0.8;
      }
      .msd-hud-metric {
        display: flex; justify-content: space-between; margin: 2px 0;
      }
      .msd-hud-metric-name { opacity: 0.9; }
      .msd-hud-metric-value { color: #00ffff; }
      .msd-hud-error { color: #ff4444; }
      .msd-hud-warning { color: #ffaa44; }
      .msd-hud-success { color: #44ff44; }
      .msd-hud-failed { color: #ff4444; }
    `;

    // Safe appendChild that works in both browser and Node.js
    if (doc.head && doc.head.appendChild) {
      doc.head.appendChild(style);
    }

    if (doc.body && doc.body.appendChild) {
      doc.body.appendChild(mount);
    } else {
      // In Node.js test environment, just mark as attached
      mount._attachedToBody = true;
    }

    return mount;
  }

  ensureMounted() {
    this.getMount(); // Creates if doesn't exist
  }

  loadPersistedState() {
    try {
      // Handle localStorage not being available in Node.js
      if (typeof localStorage !== 'undefined' && localStorage.getItem) {
        const saved = localStorage.getItem('msd-hud-state');
        if (saved) {
          const state = JSON.parse(saved);
          this.state = { ...this.state, ...state };
        }
      }
    } catch (_) {}
  }

  destroy() {
    this.stopRefreshLoop();
    const doc = (typeof document !== 'undefined') ? document : global.document;
    if (doc) {
      const mount = doc.querySelector('#msd-hud-root');
      if (mount) mount.remove();
    }
  }
}
