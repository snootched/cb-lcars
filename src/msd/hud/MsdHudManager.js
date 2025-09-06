/**
 * MSD HUD Manager - Coordinates all debug panels
 * Provides development interface for monitoring MSD v1 pipeline
 */

import { PerformancePanel } from './panels/PerformancePanel.js';
import { ValidationPanel } from './panels/ValidationPanel.js';
import { DataSourcePanel } from './panels/DataSourcePanel.js';
import { RoutingPanel } from './panels/RoutingPanel.js';

export class MsdHudManager {
  constructor() {
    this.panels = {
      performance: new PerformancePanel(),
      validation: new ValidationPanel(),
      dataSources: new DataSourcePanel(),
      routing: new RoutingPanel()
    };

    this.state = {
      visible: false,
      activePanel: 'performance',
      refreshRate: 2000,
      lastRefresh: 0
    };

    this.hudElement = null;
    this.refreshInterval = null;
    this.mountElement = null; // Add mount element storage
  }

  /**
   * Initialize with mount element from pipeline
   * @param {HTMLElement} mountElement - Mount element from pipeline
   */
  init(mountElement) {
    if (!mountElement) {
      console.warn('[MsdHudManager] No mount element provided');
      return;
    }
    this.mountElement = mountElement;
  }

  show() {
    if (this.state.visible) return;

    this.state.visible = true;
    this.createHudElement();
    this.startRefresh();
    console.log('[MsdHudManager] HUD activated');
  }

  hide() {
    if (!this.state.visible) return;

    this.state.visible = false;
    this.stopRefresh();

    if (this.hudElement) {
      this.hudElement.remove();
      this.hudElement = null;
    }
    console.log('[MsdHudManager] HUD deactivated');
  }

  createHudElement() {
    if (this.hudElement) return;

    // Require mount element - no document.body fallback
    if (!this.mountElement) {
      console.warn('[MsdHudManager] HUD not initialized with mount element');
      return;
    }

    this.hudElement = document.createElement('div');
    this.hudElement.id = 'msd-debug-hud';
    this.hudElement.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 300px;
      max-height: 80vh;
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #00ffff;
      border-radius: 8px;
      color: #00ffff;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      overflow-y: auto;
      backdrop-filter: blur(10px);
    `;

    // Use mount element instead of document.body
    this.mountElement.appendChild(this.hudElement);
    this.updateHudContent();
  }

  updateHudContent() {
    if (!this.hudElement) return;

    const data = this.captureAllData();
    const html = this.renderHudHtml(data);
    this.hudElement.innerHTML = html;
    this.state.lastRefresh = Date.now();
  }

  captureAllData() {
    const data = {};

    Object.entries(this.panels).forEach(([name, panel]) => {
      try {
        data[name] = panel.captureData();
      } catch (error) {
        console.warn(`[MsdHudManager] Panel ${name} data capture failed:`, error);
        data[name] = { error: error.message };
      }
    });

    return data;
  }

  renderHudHtml(data) {
    let html = `
      <style>
        #msd-debug-hud .msd-hud-header {
          padding: 8px;
          background: rgba(0, 255, 255, 0.2);
          border-bottom: 1px solid #00ffff;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        #msd-debug-hud .msd-hud-title {
          font-weight: bold;
        }
        #msd-debug-hud .msd-hud-controls {
          font-size: 10px;
        }
        #msd-debug-hud .msd-hud-close {
          cursor: pointer;
          padding: 2px 6px;
          background: rgba(255, 0, 0, 0.7);
          border-radius: 3px;
        }
        #msd-debug-hud .msd-hud-panel {
          padding: 8px;
          border-bottom: 1px solid rgba(0, 255, 255, 0.3);
        }
        #msd-debug-hud .msd-hud-panel h3 {
          margin: 0 0 8px 0;
          color: #ffaa00;
          font-size: 14px;
        }
        #msd-debug-hud .msd-hud-section h4 {
          margin: 6px 0 4px 0;
          color: #ffffff;
          font-size: 12px;
        }
        #msd-debug-hud .msd-hud-metric {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
          font-size: 11px;
        }
        #msd-debug-hud .msd-hud-metric-name {
          color: #aaaaaa;
        }
        #msd-debug-hud .msd-hud-metric-value {
          color: #00ffff;
          font-weight: bold;
        }
        #msd-debug-hud .msd-hud-metric-detail {
          font-size: 10px;
          color: #888888;
          margin-left: 10px;
        }
        #msd-debug-hud .msd-hud-error {
          border-left: 3px solid #ff0000;
          padding-left: 6px;
        }
        #msd-debug-hud .msd-hud-warning {
          border-left: 3px solid #ffaa00;
          padding-left: 6px;
        }
        #msd-debug-hud .msd-hud-success {
          color: #00ff00;
          font-size: 11px;
          text-align: center;
          padding: 4px;
        }
        #msd-debug-hud .msd-hud-summary {
          text-align: center;
          font-size: 11px;
          padding: 4px;
          background: rgba(255, 170, 0, 0.2);
        }
      </style>
    `;

    html += `
      <div class="msd-hud-header">
        <span class="msd-hud-title">MSD v1 Debug HUD</span>
        <div class="msd-hud-controls">
          <span class="msd-hud-close" onclick="window.__msdDebug?.hud?.hide?.()">✕</span>
        </div>
      </div>
    `;

    Object.entries(this.panels).forEach(([name, panel]) => {
      try {
        html += panel.renderHtml(data[name] || {});
      } catch (error) {
        html += `<div class="msd-hud-panel">
          <h3>${name} (Error)</h3>
          <div class="msd-hud-section">Panel render failed: ${error.message}</div>
        </div>`;
      }
    });

    const refreshAge = Math.round((Date.now() - this.state.lastRefresh) / 1000);
    html += `<div style="padding: 4px; font-size: 10px; text-align: center; color: #666;">
      Updated ${refreshAge}s ago • Auto-refresh: ${this.state.refreshRate / 1000}s
    </div>`;

    return html;
  }

  startRefresh() {
    if (this.refreshInterval) return;

    this.refreshInterval = setInterval(() => {
      if (this.state.visible) {
        this.updateHudContent();
      }
    }, this.state.refreshRate);
  }

  stopRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  toggle() {
    if (this.state.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  setRefreshRate(ms) {
    this.state.refreshRate = Math.max(500, ms);
    if (this.refreshInterval) {
      this.stopRefresh();
      this.startRefresh();
    }
  }
}
