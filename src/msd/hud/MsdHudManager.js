/**
 * MSD HUD Manager - Coordinates all debug panels
 * Provides development interface for monitoring MSD v1 pipeline
 */

import { PerformancePanel } from './panels/PerformancePanel.js';
import { ValidationPanel } from './panels/ValidationPanel.js';
import { DataSourcePanel } from './panels/DataSourcePanel.js';
import { RoutingPanel } from './panels/RoutingPanel.js';
import { ChannelTrendPanel } from './panels/ChannelTrendPanel.js';
import { FlagsPanel } from './panels/FlagsPanel.js';
import { IssuesPanel } from './panels/IssuesPanel.js';
import { PacksPanel } from './panels/PacksPanel.js';
import { RulesPanel } from './panels/RulesPanel.js';

export class MsdHudManager {
  constructor() {
    this.panels = {
      issues: new IssuesPanel(),           // Move issues first (most important)
      flags: new FlagsPanel(),             // Debug controls second
      performance: new PerformancePanel(),
      rules: new RulesPanel(),             // NEW
      packs: new PacksPanel(),             // NEW
      routing: new RoutingPanel(),
      channelTrend: new ChannelTrendPanel(),
      dataSources: new DataSourcePanel(),
      validation: new ValidationPanel()
    };

    this.state = {
      visible: false,
      activePanel: 'performance',
      refreshRate: 2000,
      lastRefresh: 0
    };

    this.hudElement = null;
    this.refreshInterval = null;
    this.mountElement = null;

    this.dragState = {
      isDragging: false,
      startX: 0,
      startY: 0,
      startLeft: 0,
      startTop: 0
    };
  }

  /**
   * Initialize with mount element from pipeline
   * @param {HTMLElement} mountElement - Mount element from pipeline
   */
  init(mountElement) {
    // Store mount element for pipeline context but don't use it for HUD mounting
    this.mountElement = mountElement;

    // ENHANCED: Store mount element in debug interface for panels to access
    if (window.__msdDebug) {
      window.__msdDebug.mountElement = mountElement;
    }

    // ADDED: Setup centralized debug status access for panels
    this._setupDebugStatusHelper();

    console.log('[MsdHudManager] Initialized with pipeline mount element reference');
  }

  // ADDED: Centralized debug status access for all panels
  _setupDebugStatusHelper() {
    if (window.__msdDebug?.getDebugStatusSilent) return; // Already setup

    const W = typeof window !== 'undefined' ? window : {};
    W.__msdDebug = W.__msdDebug || {};

    W.__msdDebug.getDebugStatusSilent = function() {
      try {
        // Try debugManager first (preferred)
        const pipelineInstance = W.__msdDebug?.pipelineInstance;
        const debugManager = pipelineInstance?.systemsManager?.debugManager;
        if (debugManager?.getSnapshot) {
          return debugManager.getSnapshot();
        }

        // Fallback to debug._state directly (no console output)
        const debug = W.__msdDebug?.debug;
        if (debug?._state) {
          return { ...debug._state };
        }

        // Last resort fallback
        return { enabled: false, initialized: false };
      } catch (e) {
        return { enabled: false, initialized: false, error: e.message };
      }
    };
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

    // ENHANCED: Use document.body for unrestricted positioning and draggability
    this.hudElement = document.createElement('div');
    this.hudElement.id = 'msd-debug-hud';
    this.hudElement.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 320px;
      max-height: 85vh;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #00ffff;
      border-radius: 8px;
      color: #00ffff;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000000;
      overflow-y: auto;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 20px rgba(0, 255, 255, 0.3);
      cursor: move;
      user-select: none;
    `;

    // ADDED: Dragging functionality
    this.setupDragging();

    // Mount to document.body for full screen access
    document.body.appendChild(this.hudElement);
    this.updateHudContent();
  }

  // ADDED: Dragging implementation
  setupDragging() {
    const startDrag = (e) => {
      e.preventDefault();
      this.dragState.isDragging = true;
      this.dragState.startX = e.clientX;
      this.dragState.startY = e.clientY;

      const rect = this.hudElement.getBoundingClientRect();
      this.dragState.startLeft = rect.left;
      this.dragState.startTop = rect.top;

      this.hudElement.style.cursor = 'grabbing';
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', endDrag);
    };

    const handleDrag = (e) => {
      if (!this.dragState.isDragging) return;

      const deltaX = e.clientX - this.dragState.startX;
      const deltaY = e.clientY - this.dragState.startY;

      let newLeft = this.dragState.startLeft + deltaX;
      let newTop = this.dragState.startTop + deltaY;

      // Constrain to viewport
      const rect = this.hudElement.getBoundingClientRect();
      newLeft = Math.max(0, Math.min(window.innerWidth - rect.width, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - rect.height, newTop));

      this.hudElement.style.left = newLeft + 'px';
      this.hudElement.style.top = newTop + 'px';
      this.hudElement.style.right = 'auto'; // Remove right positioning
    };

    const endDrag = () => {
      this.dragState.isDragging = false;
      this.hudElement.style.cursor = 'move';
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', endDrag);
    };

    this.hudElement.addEventListener('mousedown', startDrag);
  }

  // ADDED: Manual refresh capability
  refresh() {
    if (this.state.visible && this.hudElement) {
      this.updateHudContent();
      console.log('[MsdHudManager] Manual refresh triggered');
    }
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
          cursor: grab;
        }
        #msd-debug-hud .msd-hud-header:active {
          cursor: grabbing;
        }
        #msd-debug-hud .msd-hud-title {
          font-weight: bold;
          pointer-events: none;
        }
        #msd-debug-hud .msd-hud-controls {
          font-size: 10px;
          display: flex;
          gap: 4px;
          pointer-events: auto;
        }
        #msd-debug-hud .msd-hud-close {
          cursor: pointer;
          padding: 2px 6px;
          background: rgba(255, 0, 0, 0.7);
          border-radius: 3px;
          pointer-events: auto;
        }
        #msd-debug-hud .msd-hud-refresh {
          cursor: pointer;
          padding: 2px 6px;
          background: rgba(0, 255, 0, 0.7);
          border-radius: 3px;
          pointer-events: auto;
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
          <span class="msd-hud-refresh" onclick="window.__msdDebug?.hud?.refresh?.()">⟳</span>
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
      Updated ${refreshAge}s ago • Draggable • Auto: ${this.state.refreshRate / 1000}s
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
