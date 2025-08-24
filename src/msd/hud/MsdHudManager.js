/**
 * Essential HUD functionality ported from cb-lcars-dev-hud-monolithic.js
 * Focus on core development features: performance, validation, routing
 * Modular design to avoid large file corruption issues
 */

import { PerformancePanel } from './panels/PerformancePanel.js';
import { ValidationPanel } from './panels/ValidationPanel.js';
import { RoutingPanel } from './panels/RoutingPanel.js';

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

    // Initialize panels
    this.panels.set('performance', new PerformancePanel());
    this.panels.set('validation', new ValidationPanel());
    this.panels.set('routing', new RoutingPanel());
  }

  show() {
    this.state.visible = true;
    this.loadPersistedState();
    this.ensureMounted();
    this.startRefreshLoop();
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
    const snapshot = this.buildSnapshot();
    if (snapshot) {
      this.lastSnapshot = snapshot;
      this.renderPanels(snapshot);
    }
  }

  buildSnapshot() {
    // FIXED: Handle case where pipeline isn't available - still return valid snapshot
    const pipelineInstance = global.window?.__msdDebug?.pipelineInstance;

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
    return `
      <div class="msd-hud-header">
        <span class="msd-hud-title">MSD v1 HUD</span>
        <span class="msd-hud-timestamp">${new Date(snapshot.timestamp).toLocaleTimeString()}</span>
        <button onclick="if(typeof global !== 'undefined' && global.window) { global.window.__msdDebug?.hud?.hide?.() } else { window.__msdDebug?.hud?.hide?.() }">×</button>
      </div>
    `;
  }

  startRefreshLoop() {
    this.stopRefreshLoop();

    // FIXED: Ensure refresh loop works in both browser and Node.js environments
    const refreshFunction = () => {
      if (this.state.visible) {
        this.refresh();
      }
    };

    // Use appropriate timer for environment - FIXED: Ensure immediate first call
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
    return document.querySelector('#msd-hud-root') || this.createMount();
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
      // FIXED: Handle localStorage not being available in Node.js
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
    const mount = document.querySelector('#msd-hud-root');
    if (mount) mount.remove();
  }
}
