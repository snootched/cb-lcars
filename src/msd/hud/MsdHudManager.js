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
import { ExportPanel } from './panels/ExportPanel.js';

// FIXED: Move debug verification to constructor only, not on every import
console.log('[MsdHudManager] Importing ExportPanel class');

export class MsdHudManager {
  constructor() {
    // FIXED: Test ExportPanel instantiation only once during construction
    console.log('[MsdHudManager] Testing ExportPanel instantiation...');
    try {
      const testExportPanel = new ExportPanel();
      console.log('[MsdHudManager] ExportPanel test successful');
    } catch (e) {
      console.error('[MsdHudManager] ExportPanel instantiation failed:', e);
    }

    this.panels = {
      issues: new IssuesPanel(),
      flags: new FlagsPanel(),
      performance: new PerformancePanel(),
      export: new ExportPanel(),
      rules: new RulesPanel(),
      packs: new PacksPanel(),
      routing: new RoutingPanel(),
      channelTrend: new ChannelTrendPanel(),
      dataSources: new DataSourcePanel(),
      validation: new ValidationPanel()
    };

    // FIXED: Only log panel creation once during construction
    console.log('[MsdHudManager] Created panels:', Object.keys(this.panels));

    this.state = {
      visible: false,
      activePanel: 'performance',
      refreshRate: 2000,
      lastRefresh: 0,
      panelVisibility: {
        issues: true,
        flags: true,
        performance: true,
        export: true,
        rules: true,
        packs: true,
        routing: false,
        channelTrend: false,
        dataSources: false,
        validation: false
      },
      panelOrder: ['issues', 'flags', 'performance', 'export', 'rules', 'packs', 'routing', 'channelTrend', 'dataSources', 'validation'],
      compactMode: false,
      autoPosition: true,
      panelManagerOpen: false,
      hudWidth: 420,
      resizable: false
    };

    // FIXED: Only log state once during construction
    console.log('[MsdHudManager] Initial panel order:', this.state.panelOrder);

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

    this._setupGlobalPanelControls();
    this.keyboardEnabled = true;
    this._setupKeyboardShortcuts();
 }

  // ADDED: Setup global panel control handlers
  _setupGlobalPanelControls() {
    if (window.__msdHudPanelControls) return;

    const self = this;
    window.__msdHudPanelControls = {
      togglePanel: function(panelName) {
        self.state.panelVisibility[panelName] = !self.state.panelVisibility[panelName];
        // FIXED: Force immediate refresh to show state changes
        self.updateHudContent();
      },

      setCompactMode: function(enabled) {
        self.state.compactMode = enabled;
        // FIXED: Force immediate refresh to show state changes
        self.updateHudContent();
      },

      setAutoPosition: function(enabled) {
        self.state.autoPosition = enabled;
        if (enabled) {
          self._autoPositionHud();
        }
      },

      resetPanelLayout: function() {
        // FIXED: Reset to default visibility including export panel
        Object.keys(self.state.panelVisibility).forEach(panel => {
          self.state.panelVisibility[panel] = ['issues', 'flags', 'performance', 'export'].includes(panel);
        });
        self.state.compactMode = false;
        self.state.autoPosition = true;
        // FIXED: Force immediate refresh to show state changes
        self.updateHudContent();
        self._autoPositionHud();
      },

      movePanel: function(panelName, direction) {
        const currentOrder = [...self.state.panelOrder];
        const currentIndex = currentOrder.indexOf(panelName);

        if (currentIndex === -1) return;

        const newIndex = direction === 'up' ?
          Math.max(0, currentIndex - 1) :
          Math.min(currentOrder.length - 1, currentIndex + 1);

        // Swap positions
        [currentOrder[currentIndex], currentOrder[newIndex]] =
        [currentOrder[newIndex], currentOrder[currentIndex]];

        self.state.panelOrder = currentOrder;
        // FIXED: Force immediate refresh to show state changes
        self.updateHudContent();
      },

      // ENHANCED: Set up panel manager toggle handler
      togglePanelManager: function() {
        self.state.panelManagerOpen = !self.state.panelManagerOpen;

        const manager = document.getElementById('msd-panel-manager');
        if (manager) {
          manager.style.display = self.state.panelManagerOpen ? 'block' : 'none';

          // FIXED: Always attach event listeners when toggling
          if (self.state.panelManagerOpen) {
            setTimeout(() => self._attachPanelManagerEventListeners(), 10);
          }
        }

        console.log('[MsdHudManager] Panel manager toggled:', self.state.panelManagerOpen);
      },

      // ADDED: Close panel manager handler
      closePanelManager: function() {
        self.state.panelManagerOpen = false;

        const manager = document.getElementById('msd-panel-manager');
        if (manager) {
          manager.style.display = 'none';
        }

        console.log('[MsdHudManager] Panel manager closed');
      }
    };
  }

  // ADDED: Auto-positioning logic
  _autoPositionHud() {
    if (!this.state.autoPosition || !this.hudElement) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const hudWidth = this.state.hudWidth; // ENHANCED: Use configurable width

    // Calculate optimal height based on visible panels
    const visiblePanelCount = Object.values(this.state.panelVisibility).filter(Boolean).length;
    const estimatedHeight = Math.min(
      viewportHeight * 0.9, // ENHANCED: Increased from 0.85 to 0.9
      200 + (visiblePanelCount * (this.state.compactMode ? 80 : 140)) // ENHANCED: Increased panel height estimate
    );

    // Check for Home Assistant header and sidebar
    const haHeader = document.querySelector('app-header, ha-app-layout app-header');
    const haSidebar = document.querySelector('ha-sidebar, app-drawer-layout ha-sidebar');

    const headerHeight = haHeader ? haHeader.offsetHeight : 0;
    const sidebarWidth = haSidebar && !haSidebar.hasAttribute('collapsed') ?
      haSidebar.offsetWidth : 0;

    // Smart positioning algorithm
    let left, top;

    // Try right side first (most common)
    left = viewportWidth - hudWidth - 20;

    // If sidebar takes up left space, ensure we don't overlap
    if (sidebarWidth > 0 && left < sidebarWidth + 20) {
      left = Math.max(sidebarWidth + 20, viewportWidth - hudWidth - 20);
    }

    // If still not enough space, try left side
    if (left < 20) {
      left = 20;
    }

    // Vertical positioning accounting for header
    top = Math.max(headerHeight + 20, 20);

    // Ensure bottom doesn't go off screen
    if (top + estimatedHeight > viewportHeight - 20) {
      top = Math.max(headerHeight + 20, viewportHeight - estimatedHeight - 20);
    }

    // ADDED: Smooth positioning transition
    this.hudElement.style.transition = 'all 0.3s ease';
    this.hudElement.style.left = left + 'px';
    this.hudElement.style.top = top + 'px';
    this.hudElement.style.right = 'auto';

    // Remove transition after animation
    setTimeout(() => {
      this.hudElement.style.transition = '';
    }, 300);

    console.log(`[MsdHudManager] Auto-positioned to (${left}, ${top}) avoiding header:${headerHeight}px sidebar:${sidebarWidth}px`);
  }

  // ADDED: Handle window resize for auto-positioning
  _setupResizeHandler() {
    if (this._resizeSetup) return;
    this._resizeSetup = true;

    let resizeTimeout;
    window.addEventListener('resize', () => {
      if (this.state.autoPosition && this.state.visible) {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          this._autoPositionHud();
        }, 250);
      }
    });
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

    // ENHANCED: Setup resize handler and auto-position
    this._setupResizeHandler();

    // FIXED: Properly expose HUD manager globally
    if (window.__msdDebug) {
      window.__msdDebug.hud = {
        manager: this,
        refresh: () => this.refresh(),
        hide: () => this.hide(),
        show: () => this.show(),
        toggle: () => this.toggle(),
        setRefreshRate: (rate) => this.setRefreshRate(rate)
      };
    }

    if (this.state.autoPosition) {
      setTimeout(() => this._autoPositionHud(), 100);
    }

    console.log('[MsdHudManager] HUD activated and exposed globally');
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

    // ENHANCED: Use configurable width and improved styling
    this.hudElement = document.createElement('div');
    this.hudElement.id = 'msd-debug-hud';
    this.hudElement.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: ${this.state.hudWidth}px;
      max-height: 90vh;
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
      ${this.state.resizable ? 'resize: horizontal; min-width: 300px; max-width: 600px;' : ''}
    `;

    // ADDED: Dragging functionality
    this.setupDragging();

    // Mount to document.body for full screen access
    document.body.appendChild(this.hudElement);
    this.updateHudContent();
  }

  updateHudContent() {
    if (!this.hudElement) return;

    // Skip update if routing panel inputs are focused to prevent refresh interference
    if (this.panels.routing?.shouldSkipRefresh?.()) {
      return;
    }

    // FIXED: Preserve panel manager state without logging every refresh
    const wasManagerOpen = this.state.panelManagerOpen;

    const data = {};

    // Capture data from all panels
    Object.entries(this.panels).forEach(([panelName, panel]) => {
      try {
        if (panel.captureData) {
          data[panelName] = panel.captureData();
        }
      } catch (error) {
        console.warn(`[MsdHudManager] Panel ${panelName} data capture failed:`, error);
        data[panelName] = { error: error.message };
      }
    });

    // Update timestamp
    this.state.lastRefresh = Date.now();

    // Render HTML
    try {
      const html = this.renderHudHtml(data);
      this.hudElement.innerHTML = html;

      // Apply compact mode class
      if (this.state.compactMode) {
        this.hudElement.classList.add('msd-hud-compact');
      } else {
        this.hudElement.classList.remove('msd-hud-compact');
      }

      this._attachPanelManagerEventListeners();

      // Restore panel manager state after render
      if (wasManagerOpen) {
        this.state.panelManagerOpen = true;
        const manager = document.getElementById('msd-panel-manager');
        if (manager) {
          manager.style.display = 'block';
        }
      }
    } catch (error) {
      console.error('[MsdHudManager] HUD render failed:', error);
      this.hudElement.innerHTML = `
        <div class="msd-hud-header">
          <span class="msd-hud-title">MSD Debug HUD - Error</span>
          <span class="msd-hud-close" onclick="window.__msdDebug?.hud?.hide?.()" title="Close">✕</span>
        </div>
        <div style="padding:8px;color:#ff6666;">
          Render failed: ${error.message}
        </div>
      `;
    }
  }

  renderHudHtml(data) {
    const compactClass = this.state.compactMode ? 'msd-hud-compact' : '';

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
        #msd-debug-hud .msd-hud-close, #msd-debug-hud .msd-hud-refresh {
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 3px;
          pointer-events: auto;
        }
        #msd-debug-hud .msd-hud-close {
          background: rgba(255, 0, 0, 0.7);
        }
        #msd-debug-hud .msd-hud-refresh {
          background: rgba(0, 255, 0, 0.7);
        }
        #msd-debug-hud .msd-hud-menu {
          background: rgba(255, 170, 0, 0.7);
        }

        /* ADDED: Panel management styles */
        #msd-debug-hud .msd-panel-controls {
          padding: 6px;
          background: rgba(50, 50, 70, 0.8);
          border-bottom: 1px solid rgba(0, 255, 255, 0.3);
          font-size: 10px;
        }
        #msd-debug-hud .msd-panel-toggles {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 6px;
        }
        #msd-debug-hud .msd-panel-toggle {
          cursor: pointer;
          padding: 2px 6px;
          border: 1px solid #444;
          border-radius: 3px;
          font-size: 9px;
          transition: all 0.2s;
        }
        #msd-debug-hud .msd-panel-toggle.enabled {
          background: rgba(0, 255, 255, 0.3);
          color: #ffffff;
        }
        #msd-debug-hud .msd-panel-toggle.disabled {
          background: rgba(100, 100, 100, 0.3);
          color: #888888;
        }
        #msd-debug-hud .msd-panel-toggle:hover {
          border-color: #00ffff;
        }

        #msd-debug-hud .msd-hud-panel {
          padding: ${this.state.compactMode ? '4px' : '8px'};
          border-bottom: 1px solid rgba(0, 255, 255, 0.3);
          transition: all 0.3s ease;
        }
        #msd-debug-hud .msd-hud-panel.hidden {
          display: none;
        }
        #msd-debug-hud .msd-hud-panel h3 {
          margin: 0 0 ${this.state.compactMode ? '4px' : '8px'} 0;
          color: #ffaa00;
          font-size: ${this.state.compactMode ? '12px' : '14px'};
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        /* ADDED: Compact mode adjustments */
        #msd-debug-hud.msd-hud-compact .msd-hud-metric {
          margin: 1px 0;
          font-size: 10px;
        }
        #msd-debug-hud.msd-hud-compact .msd-hud-section h4 {
          margin: 3px 0 2px 0;
          font-size: 11px;
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
          <span class="msd-hud-menu" onclick="window.__msdHudPanelControls?.togglePanelManager?.()" title="Panel Settings">⚙</span>
          <span class="msd-hud-refresh" onclick="window.__msdDebug?.hud?.refresh?.()" title="Refresh">⟳</span>
          <span class="msd-hud-close" onclick="window.__msdDebug?.hud?.hide?.()" title="Close">✕</span>
        </div>
      </div>
    `;

    // ADDED: Panel management interface (initially hidden)
    html += this._renderPanelControls();

    // FIXED: Debug panel rendering with detailed logging
    let renderedPanelCount = 0;
    let visiblePanelCount = 0;

    this.state.panelOrder.forEach(panelName => {
      const panel = this.panels[panelName];
      if (!panel) {
        console.warn(`[MsdHudManager] Panel '${panelName}' not found in panels object`);
        return;
      }

      const isVisible = this.state.panelVisibility[panelName];
      const hiddenClass = isVisible ? '' : 'hidden';

      if (isVisible) {
        visiblePanelCount++;
      }

      try {
        const panelData = data[panelName] || {};

        const panelHtml = panel.renderHtml(panelData);

        // Wrap panel with visibility control
        html += `<div class="msd-hud-panel ${hiddenClass}" data-panel="${panelName}">
          ${panelHtml}
        </div>`;

        renderedPanelCount++;
      } catch (error) {
        console.error(`[MsdHudManager] Panel ${panelName} render failed:`, error);
        html += `<div class="msd-hud-panel ${hiddenClass}" data-panel="${panelName}">
          <h3>${panelName} (Error)</h3>
          <div class="msd-hud-section">Panel render failed: ${error.message}</div>
        </div>`;

        renderedPanelCount++;
      }
    });

    const refreshAge = Math.round((Date.now() - this.state.lastRefresh) / 1000);

    // FIXED: Correct panel counting in footer
    html += `<div style="padding: 4px; font-size: 10px; text-align: center; color: #666;">
      ${visiblePanelCount}/${renderedPanelCount} panels visible • Updated ${refreshAge}s ago • ${this.state.refreshRate / 1000}s
      <div style="font-size: 9px; margin-top: 2px; opacity: 0.7;">
        Shortcuts: Ctrl+H toggle • Ctrl+R refresh • Ctrl+P panels • Ctrl+K compact • 1-9 toggle panels
      </div>
      <div style="font-size: 8px; margin-top: 1px; opacity: 0.5;">
        Panels: [${this.state.panelOrder.join(', ')}] | Available: [${Object.keys(this.panels).join(', ')}]
      </div>
    </div>`;

    return html;
  }

  // ADDED: Missing startRefresh method
  startRefresh() {
    this.stopRefresh(); // Clear any existing interval

    if (this.state.refreshRate > 0) {
      this.refreshInterval = setInterval(() => {
        if (this.state.visible) {
          this.updateHudContent();
        }
      }, this.state.refreshRate);
    }
  }

  // ADDED: Missing stopRefresh method
  stopRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // ADDED: Missing toggle method
  toggle() {
    if (this.state.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  // ADDED: Missing setRefreshRate method
  setRefreshRate(rate) {
    const numRate = parseInt(rate);
    if (isNaN(numRate) || numRate < 0) return;

    this.state.refreshRate = numRate;

    if (this.state.visible) {
      this.startRefresh(); // Restart with new rate
    }
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

  // ADDED: Render panel controls interface
  _renderPanelControls() {
    let html = `<div class="msd-panel-controls" id="msd-panel-manager" style="display: ${this.state.panelManagerOpen ? 'block' : 'none'};">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <strong>Panel Settings</strong>
        <div style="display: flex; gap: 4px;">
          <button data-action="compact"
            style="font-size: 9px; padding: 1px 4px; background: ${this.state.compactMode ? '#ffaa00' : '#333'}; color: ${this.state.compactMode ? '#000' : '#fff'}; border: 1px solid #555; border-radius: 2px; cursor: pointer;">
            Compact
          </button>
          <button data-action="reset"
            style="font-size: 9px; padding: 1px 4px; background: #666; color: #fff; border: 1px solid #888; border-radius: 2px; cursor: pointer;">
            Reset
          </button>
          <button data-action="close"
            style="font-size: 9px; padding: 1px 4px; background: #ff4444; color: #fff; border: 1px solid #666; border-radius: 2px; cursor: pointer;">
            ✕
          </button>
        </div>
      </div>

      <div class="msd-panel-toggles">`;

    this.state.panelOrder.forEach(panelName => {
      const isEnabled = this.state.panelVisibility[panelName];
      const enabledClass = isEnabled ? 'enabled' : 'disabled';

      html += `<div class="msd-panel-toggle ${enabledClass}"
        data-panel-toggle="${panelName}"
        title="Toggle ${panelName} panel"
        style="cursor: pointer;">
        ${panelName}
      </div>`;
    });

    html += `</div>

      <div style="margin-top: 6px; font-size: 9px; color: #888;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span>Refresh Rate:</span>
          <span>HUD Width: ${this.state.hudWidth}px</span>
        </div>
        <div style="display: flex; gap: 4px; align-items: center;">
          <select id="msd-hud-refresh-rate" name="refresh-rate" data-action="refresh-rate" style="font-size: 9px; background: #333; color: #fff; border: 1px solid #555; flex: 1;">
            <option value="1000" ${this.state.refreshRate === 1000 ? 'selected' : ''}>1s</option>
            <option value="2000" ${this.state.refreshRate === 2000 ? 'selected' : ''}>2s</option>
            <option value="5000" ${this.state.refreshRate === 5000 ? 'selected' : ''}>5s</option>
            <option value="10000" ${this.state.refreshRate === 10000 ? 'selected' : ''}>10s</option>
          </select>
          <button data-action="width-down" title="Narrower"
            style="font-size: 9px; padding: 1px 4px; background: #444; color: #fff; border: 1px solid #666; border-radius: 2px; cursor: pointer;">◀</button>
          <button data-action="width-up" title="Wider"
            style="font-size: 9px; padding: 1px 4px; background: #444; color: #fff; border: 1px solid #666; border-radius: 2px; cursor: pointer;">▶</button>
        </div>
      </div>
    </div>`;

    return html;
  }

  _attachPanelManagerEventListeners() {
    try {
      const manager = document.getElementById('msd-panel-manager');
      if (!manager) return;

      const compactBtn = manager.querySelector('[data-action="compact"]');
      if (compactBtn) {
        compactBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.__msdHudPanelControls?.setCompactMode(!this.state.compactMode);
        };
      }

      const resetBtn = manager.querySelector('[data-action="reset"]');
      if (resetBtn) {
        resetBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.__msdHudPanelControls?.resetPanelLayout();
        };
      }

      const closeBtn = manager.querySelector('[data-action="close"]');
      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.__msdHudPanelControls?.closePanelManager();
        };
      }

      const toggleBtns = manager.querySelectorAll('[data-panel-toggle]');
      toggleBtns.forEach(btn => {
        const panelName = btn.getAttribute('data-panel-toggle');
        if (panelName) {
          btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.__msdHudPanelControls?.togglePanel(panelName);
          };
        }
      });

      const refreshSelect = manager.querySelector('[data-action="refresh-rate"]');
      if (refreshSelect) {
        refreshSelect.onchange = (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.__msdDebug?.hud?.setRefreshRate?.(parseInt(refreshSelect.value));
        };
      }

      const widthDownBtn = manager.querySelector('[data-action="width-down"]');
      if (widthDownBtn) {
        widthDownBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.adjustWidth(-20);
        };
      }

      const widthUpBtn = manager.querySelector('[data-action="width-up"]');
      if (widthUpBtn) {
        widthUpBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.adjustWidth(20);
        };
      }
    } catch (e) {
      console.warn('[MsdHudManager] Failed to attach panel manager event listeners:', e);
    }
  }

  adjustWidth(delta) {
    const newWidth = Math.max(300, Math.min(600, this.state.hudWidth + delta));
    if (newWidth !== this.state.hudWidth) {
      this.state.hudWidth = newWidth;

      if (this.hudElement) {
        this.hudElement.style.width = newWidth + 'px';
      }

      console.log(`[MsdHudManager] HUD width adjusted to ${newWidth}px`);

      setTimeout(() => this.updateHudContent(), 100);
    }
  }

  // ADDED: Keyboard shortcut system
  _setupKeyboardShortcuts() {
    if (this._keyboardSetup) return;
    this._keyboardSetup = true;

    const self = this;
    document.addEventListener('keydown', (e) => {
      if (!self.keyboardEnabled || !self.state.visible) return;

      // Only handle shortcuts when not in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Ctrl/Cmd + specific keys for HUD control
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'h':
            e.preventDefault();
            self.toggle();
            break;

          case 'r':
            if (self.state.visible) {
              e.preventDefault();
              self.refresh();
            }
            break;

          case 'p':
            if (self.state.visible) {
              e.preventDefault();
              window.__msdHudPanelControls?.togglePanelManager?.();
            }
            break;

          case 'k':
            if (self.state.visible) {
              e.preventDefault();
              self.state.compactMode = !self.state.compactMode;
              self.updateHudContent();
            }
            break;
        }
      }

      // Number keys to toggle panels (1-9)
      if (self.state.visible && !e.ctrlKey && !e.metaKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
          const panelName = self.state.panelOrder[num - 1];
          if (panelName) {
            e.preventDefault();
            window.__msdHudPanelControls?.togglePanel(panelName);
          }
        }
      }
    });

    // Global shortcut to show HUD (Ctrl+Shift+H)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        self.toggle();
      }
    });
  }
}
