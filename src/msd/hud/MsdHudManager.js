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
import { HudEventBus } from './hudService.js'; // existing
import { SelectionManager } from './hudService.js'; // ADDED
import { OverlaysPanel } from './panels/OverlaysPanel.js'; // ADDED

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

    this.bus = new HudEventBus(); // ADDED
    window.__msdHudBus = (evt, payload) => this.bus.emit(evt, payload || {}); // ADDED global helper

    this.panels = {
      issues: new IssuesPanel(),
      flags: new FlagsPanel(),
      performance: new PerformancePanel(),
      export: new ExportPanel(),
      rules: new RulesPanel(),
      packs: new PacksPanel(),
      overlays: new OverlaysPanel(), // ADDED
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
        overlays: true, // ADDED (default visible)
        routing: false,
        channelTrend: false,
        dataSources: false,
        validation: false
      },
      panelOrder: ['issues','flags','performance','export','rules','packs','overlays','routing','channelTrend','dataSources','validation'], // UPDATED
      compactMode: false,
      autoPosition: true,
      panelManagerOpen: false,
      hudWidth: 420,
      resizable: false,
      // ADDED: Font and scaling options
      fontSize: 14, // Base font size in pixels (default 14px)
      hudScale: 1.0, // Overall HUD scale factor (0.8 - 1.5)
      fontFamily: '"Antonio", monospace' // Font family with LCARS default + fallback
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

    // ADDED: Provide bus to panels (optional future use)
    Object.values(this.panels).forEach(p => { p.bus = this.bus; });

    this._registerBusHandlers(); // ADDED
    this.selection = new SelectionManager(this.bus); // ADDED
    this._registerSelectionHandlers(); // ADDED

    // ADDED: Bind core instance methods to prevent context loss in external handlers
    this.show = this.show.bind(this);
    this.hide = this.hide.bind(this);
    this.toggle = this.toggle.bind(this);
    this.refresh = this.refresh.bind(this);
    this.setRefreshRate = this.setRefreshRate.bind(this);
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
      },

      // ADDED: Font size controls
      adjustFontSize: function(delta) {
        // FIXED: Add throttling to prevent rapid multiple calls
        if (self._fontSizeThrottle) return;
        self._fontSizeThrottle = true;

        setTimeout(() => {
          self._fontSizeThrottle = false;
        }, 200); // 200ms throttle

        const newSize = Math.max(8, Math.min(20, self.state.fontSize + delta));
        if (newSize !== self.state.fontSize) {
          self.state.fontSize = newSize;
          self._applyFontAndScale();
          console.log(`[MsdHudManager] Font size adjusted to ${newSize}px`);
        }
      },

      setFontSize: function(size) {
        const newSize = Math.max(8, Math.min(20, parseInt(size) || 14));
        if (newSize !== self.state.fontSize) {
          self.state.fontSize = newSize;
          self._applyFontAndScale();
          console.log(`[MsdHudManager] Font size set to ${newSize}px`);
        }
      },

      // ADDED: HUD scale controls
      adjustHudScale: function(delta) {
        // FIXED: Add throttling to prevent rapid multiple calls
        if (self._scaleThrottle) return;
        self._scaleThrottle = true;

        setTimeout(() => {
          self._scaleThrottle = false;
        }, 200); // 200ms throttle

        const newScale = Math.max(0.7, Math.min(2.0, self.state.hudScale + delta));
        if (Math.abs(newScale - self.state.hudScale) > 0.05) {
          self.state.hudScale = newScale;
          self._applyFontAndScale();
          console.log(`[MsdHudManager] HUD scale adjusted to ${newScale.toFixed(2)}x`);
        }
      },

      setHudScale: function(scale) {
        const newScale = Math.max(0.7, Math.min(2.0, parseFloat(scale) || 1.0));
        if (Math.abs(newScale - self.state.hudScale) > 0.05) {
          self.state.hudScale = newScale;
          self._applyFontAndScale();
          console.log(`[MsdHudManager] HUD scale set to ${newScale.toFixed(2)}x`);
        }
      },

      // ADDED: Font family controls
      setFontFamily: function(family) {
        console.log(`[MsdHudManager] setFontFamily called with: "${family}"`);
        const validFamilies = [
          '"Antonio", monospace',
          'monospace',
          'sans-serif',
          'serif',
          '"Courier New", monospace',
          '"Roboto Mono", monospace'
        ];

        // Handle HTML-encoded quotes and normalize
        let normalizedFamily = family;
        if (family.includes('&quot;')) {
          normalizedFamily = family.replace(/&quot;/g, '"');
        }

        console.log(`[MsdHudManager] Normalized font family: "${normalizedFamily}"`);

        if (validFamilies.includes(normalizedFamily)) {
          self.state.fontFamily = normalizedFamily;
          self._applyFontAndScale();
          // FIXED: Don't force a content update that might close dropdowns
          // setTimeout(() => self.updateHudContent(), 50);
          console.log(`[MsdHudManager] Font family successfully set to: ${normalizedFamily}`);
        } else {
          console.warn(`[MsdHudManager] Invalid font family: "${family}" (normalized: "${normalizedFamily}")`, {
            validFamilies,
            received: family,
            normalized: normalizedFamily
          });
        }
      }
    };
  }

  // ADDED: Apply font size and scale changes
  _applyFontAndScale() {
    if (!this.hudElement) return;

    const baseFontSize = this.state.fontSize;
    const scale = this.state.hudScale;
    const family = this.state.fontFamily;

    // Apply transform and font changes to the main HUD element
    this.hudElement.style.transform = `scale(${scale})`;
    this.hudElement.style.transformOrigin = 'top left';
    this.hudElement.style.fontFamily = family;
    this.hudElement.style.fontSize = `${baseFontSize}px`;

    // Adjust positioning if scaled to prevent clipping
    if (scale !== 1.0) {
      const rect = this.hudElement.getBoundingClientRect();
      const scaledWidth = this.state.hudWidth * scale;
      const scaledHeight = rect.height * scale;

      // Ensure HUD doesn't go off-screen when scaled
      const currentLeft = parseInt(this.hudElement.style.left) || 0;
      const currentTop = parseInt(this.hudElement.style.top) || 0;

      const maxLeft = window.innerWidth - scaledWidth - 10;
      const maxTop = window.innerHeight - scaledHeight - 10;

      if (currentLeft > maxLeft) {
        this.hudElement.style.left = Math.max(10, maxLeft) + 'px';
      }
      if (currentTop > maxTop) {
        this.hudElement.style.top = Math.max(10, maxTop) + 'px';
      }
    }

    console.log(`[MsdHudManager] Applied font: ${baseFontSize}px ${family}, scale: ${scale}x`);
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

  _registerBusHandlers() {
    const { routing, performance, flags, export: exp, dataSources, issues, overlays } = this.panels;

    // Routing
    this.bus.on('routing:highlight', ({ id }) => routing?.highlightRoute?.(id));
    this.bus.on('routing:analyze', ({ id }) => routing?.analyzeRoute?.(id));
    this.bus.on('routing:set-filter', ({ key, value }) => routing?.setFilter?.(key, value));
    this.bus.on('routing:update-cost', ({ key, value }) => routing?.updateCostFilter?.(key, value));
    this.bus.on('routing:finalize-cost', () => routing?.finalizeCostFilter?.());
    this.bus.on('routing:focus-set', ({ field, focus }) => routing?.setInputFocus?.(field, focus));

    // Performance
    this.bus.on('performance:clear-all', () => performance?.clearAllTimers?.());
    this.bus.on('performance:export', () => performance?.exportData?.());
    this.bus.on('performance:reset-timer', ({ timer }) => performance?.resetTimer?.(timer));
    this.bus.on('performance:set-threshold', ({ timer, value }) => performance?.setThreshold?.(timer, value));

    // Flags
    this.bus.on('flags:toggle', ({ feature }) => flags?.toggleFeature?.(feature));
    this.bus.on('flags:scale-adjust', ({ dir }) => flags?.adjustScale?.(dir));
    this.bus.on('flags:scale-set', ({ scale }) => flags?.setScale?.(scale));
    this.bus.on('flags:refresh', () => flags?.refreshDebug?.());

    // Export
    this.bus.on('export:collapsed', () => exp?.exportCollapsed?.());
    this.bus.on('export:full', () => exp?.exportFull?.(false));
    this.bus.on('export:full-meta', () => exp?.exportFull?.(true));
    this.bus.on('export:copy', ({ type }) => exp?.copyToClipboard?.(type));
    this.bus.on('export:clear', ({ type }) => exp?.clearTextarea?.(type));

    // Data sources
    this.bus.on('datasource:inspect', ({ id }) => dataSources?.inspectEntity?.(id));
    this.bus.on('datasource:refresh-subs', () => dataSources?.refreshSubscriptions?.());
    this.bus.on('datasource:clear-history', () => dataSources?.clearHistory?.());

    // Issues
    this.bus.on('issues:action', ({ action, id, overlay }) => issues?.handleIssueClick?.(action, id, overlay));

    // ADDED: Overlay highlight bus
    this.bus.on('overlay:highlight', ({ id }) => overlays?.highlightOverlay?.(id));
    // ADDED: overlay analyze
    this.bus.on('overlay:analyze', ({ id }) => overlays?.analyzeOverlay?.(id));

    // Generic
    this.bus.on('hud:refresh', () => this.refresh());

    // ADDED: HUD settings controls
    this.bus.on('refresh-rate:change', ({ value }) => {
      console.log('[MsdHudManager] Refresh rate change event:', value);
      const rate = parseInt(value);
      if (!isNaN(rate) && rate > 0) {
        this.setRefreshRate(rate);
        console.log('[MsdHudManager] Refresh rate set to:', rate);
      }
    });

    this.bus.on('width:adjust', ({ delta }) => {
      console.log('[MsdHudManager] Width adjust event:', delta);
      this.adjustWidth(parseInt(delta));
    });

    this.bus.on('font:adjust', ({ delta }) => {
      console.log('[MsdHudManager] Font adjust event:', delta, 'throttled:', !!this._fontSizeThrottle);
      window.__msdHudPanelControls?.adjustFontSize(parseInt(delta));
    });

    this.bus.on('scale:adjust', ({ delta }) => {
      console.log('[MsdHudManager] Scale adjust event:', delta, 'throttled:', !!this._scaleThrottle);
      window.__msdHudPanelControls?.adjustHudScale(parseFloat(delta));
    });

    this.bus.on('font-family:change', ({ value }) => {
      console.log('[MsdHudManager] Font family change event:', value);
      // FIXED: Add small delay to prevent event conflicts
      setTimeout(() => {
        window.__msdHudPanelControls?.setFontFamily(value);
      }, 10);
    });

    this.bus.on('font:reset', () => {
      console.log('[MsdHudManager] Font reset event');
      this.state.fontSize = 14;
      this.state.hudScale = 1.0;
      this.state.fontFamily = '"Antonio", monospace';
      this._applyFontAndScale();
      this.updateHudContent();
      console.log('[MsdHudManager] Font settings reset to defaults');
    });
  }

  _registerSelectionHandlers() { // ADDED
    this.bus.on('select:set', ({ type, id, source }) => {
      this.selection.set(type, id, { source });
      // Optional contextual highlight actions
      if (type === 'route') {
        this.bus.emit('routing:highlight', { id });
      } else if (type === 'overlay') {
        this.bus.emit('overlay:highlight', { id });
      }
      this.refresh();
    });
    this.bus.on('select:clear', () => {
      this.selection.clear();
      this.refresh();
    });
    // Passive listener to apply highlight after render
    this.bus.on('select:changed', () => {
      // If HUD already rendered, apply highlight without full refresh
      this._applySelectionHighlight();
      this._updateSelectionBadge();
    });
  }

  _applySelectionHighlight() { // ADDED
    if (!this.hudElement) return;
    const sel = this.selection.get();
    // Clear old
    this.hudElement.querySelectorAll('.msd-selected').forEach(el => el.classList.remove('msd-selected'));
    if (!sel) return;
    // Match any element with matching data-select-type & id
    const matches = this.hudElement.querySelectorAll(
      `[data-select-type="${sel.type}"][data-select-id="${CSS.escape(sel.id)}"]`
    );
    matches.forEach(el => el.classList.add('msd-selected'));
  }

  _updateSelectionBadge() { // ADDED
    if (!this.hudElement) return;
    const badge = this.hudElement.querySelector('#msd-selection-badge');
    if (!badge) return;
    const sel = this.selection.get();
    if (!sel) {
      badge.innerHTML = '';
      return;
    }
    badge.innerHTML = `
      <span style="background:#222;border:1px solid #444;padding:2px 6px;border-radius:4px;font-size:10px;display:inline-flex;gap:6px;align-items:center;">
        <span style="color:#ffaa00;">${sel.type}</span>
        <span style="color:#00ffff;max-width:160px;overflow:hidden;text-overflow:ellipsis;">${sel.id}</span>
        <button data-bus-event="select:clear"
          onclick="__msdHudBus('select:clear')"
          style="background:#333;color:#ccc;border:1px solid #555;border-radius:3px;font-size:9px;cursor:pointer;padding:0 4px;">
          ✕
        </button>
      </span>
    `;
  }

  // ADDED: Toggle collapse
  togglePanelCollapse(panelName) {
    this.state.collapsedPanels[panelName] = !this.state.collapsedPanels[panelName];
    // Lightweight re-render (no data recapture)
    this._applyCollapseState();
  }

  // ADDED: Toggle focus (exclusive view)
  toggleFocusPanel(panelName) {
    if (this.state.focusPanel === panelName) {
      this.state.focusPanel = null;
    } else {
      this.state.focusPanel = panelName;
    }
    this.updateHudContent();
  }

  // ADDED: Apply collapse styling post-render
  _applyCollapseState() {
    if (!this.hudElement) return;
    const wrappers = this.hudElement.querySelectorAll('.msd-hud-panel[data-panel]');
    wrappers.forEach(w => {
      const name = w.getAttribute('data-panel');
      const collapsed = this.state.collapsedPanels[name];
      if (collapsed) {
        w.classList.add('collapsed');
      } else {
        w.classList.remove('collapsed');
      }
      // Update indicator symbol
      const h3 = w.querySelector(':scope h3');
      const ind = h3?.querySelector('.msd-collapse-indicator');
      if (ind) ind.textContent = collapsed ? '+' : '−';
      // Focus visibility
      if (this.state.focusPanel && this.state.focusPanel !== name) {
        w.classList.add('focus-hidden');
      } else {
        w.classList.remove('focus-hidden');
      }
      // Filter handling
      if (this.state.filterTerm) {
        const term = this.state.filterTerm.toLowerCase();
        const matches = name.toLowerCase().includes(term);
        if (!matches) {
          w.classList.add('filter-hidden');
        } else {
          w.classList.remove('filter-hidden');
        }
      } else {
        w.classList.remove('filter-hidden');
      }
    });
    this._updateFocusBadgeInFooter();
  }

  // ADDED: Decorate panel headers after render
  _decoratePanelHeaders() {
    if (!this.hudElement) return;
    const wrappers = this.hudElement.querySelectorAll('.msd-hud-panel[data-panel]');
    wrappers.forEach(w => {
      const name = w.getAttribute('data-panel');
      const h3 = w.querySelector(':scope h3'); // first h3 inside nested structure
      if (!h3 || h3.dataset.enhanced === '1') return;
      h3.dataset.enhanced = '1';
      h3.style.cursor = 'pointer';
      // Insert collapse indicator
      const indicator = document.createElement('span');
      indicator.className = 'msd-collapse-indicator';
      indicator.style.cssText = 'margin-left:6px;font-weight:bold;color:#ffaa00;';
      indicator.textContent = this.state.collapsedPanels[name] ? '+' : '−';
      h3.appendChild(indicator);
      h3.title = 'Click: Collapse/Expand • Alt+Click: Focus panel';
      h3.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.altKey) {
          this.toggleFocusPanel(name);
        } else {
          this.togglePanelCollapse(name);
        }
      });
    });
    this._applyCollapseState();
  }

  // ADDED: Footer focus badge update
  _updateFocusBadgeInFooter() {
    if (!this.hudElement) return;
    const footerFocus = this.hudElement.querySelector('#msd-focus-footer');
    if (!footerFocus) return;
    if (!this.state.focusPanel) {
      footerFocus.innerHTML = '';
      return;
    }
    footerFocus.innerHTML = `
      <span style="background:#222;border:1px solid #444;padding:2px 6px;border-radius:4px;font-size:9px;">
        Focus: <strong style="color:#ffaa00;">${this.state.focusPanel}</strong>
        <button style="margin-left:6px;font-size:9px;background:#333;color:#ccc;border:1px solid #555;border-radius:3px;cursor:pointer;padding:0 4px;"
          onclick="__msdHudBus && window.__msdDebug?.hud?.manager?.toggleFocusPanel && window.__msdDebug.hud.manager.toggleFocusPanel('${this.state.focusPanel}')">
          Exit
        </button>
      </span>
    `;
  }

  // ADDED: Quick filter apply (called on input)
  setFilterTerm(term) {
    this.state.filterTerm = term || '';
    this._applyCollapseState();
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

    // ADDED: Dragging functionality - only allow dragging from header
    this.setupDragging();

    // Mount to document.body for full screen access
    document.body.appendChild(this.hudElement);
    this.updateHudContent();

    this._attachDelegatedEvents(); // ADDED
  }

  _attachDelegatedEvents() {
    if (this._delegatedEventsAttached || !this.hudElement) return;
    this._delegatedEventsAttached = true;

    const mapEvent = (domEvent) => {
      this.hudElement.addEventListener(domEvent, (e) => {
        const target = e.target.closest('[data-bus-event]');
        if (!target || !this.hudElement.contains(target)) return;

        // FIXED: For select elements, only handle 'change' events, not 'click' or 'input'
        if (target.tagName === 'SELECT' && domEvent !== 'change') {
          return; // Don't handle click/input events on select elements
        }

        // FIXED: For buttons, only handle 'click' events to prevent multiple firing
        if (target.tagName === 'BUTTON' && domEvent !== 'click') {
          return; // Don't handle other events on buttons
        }

        // FIXED: Prevent multiple event handling
        e.preventDefault();
        e.stopPropagation();

        // Build payload from data-* excluding busEvent
        const { busEvent, ...rest } = Object.fromEntries(
          Object.entries(target.dataset).map(([k, v]) => [k.replace(/-[a-z]/g, m => m[1].toUpperCase()), v])
        );

        // For select elements, add the selected value
        if (target.tagName === 'SELECT') {
          rest.value = target.value;
        }

        // Numeric coercion for simple numbers
        Object.keys(rest).forEach(k => {
          if (/^-?\d+(\.\d+)?$/.test(rest[k])) rest[k] = Number(rest[k]);
        });

        console.log(`[MsdHudManager] Bus event: ${target.dataset.busEvent}`, rest);
        this.bus.emit(target.dataset.busEvent, rest);
      }, true);
    };

    ['click', 'change', 'input', 'blur', 'focus'].forEach(mapEvent);
    // ADDED: Direct listener for filter input (outside data-bus-event)
    this.hudElement.addEventListener('input', (e) => {
      const el = e.target;
      if (el && el.id === 'msd-hud-filter') {
        this.setFilterTerm(el.value);
      }
    }, true);
  }

  updateHudContent() {
    if (!this.hudElement) return;

    // Skip update if routing panel inputs are focused to prevent refresh interference
    if (this.panels.routing?.shouldSkipRefresh?.()) {
      return;
    }

    // FIXED: Skip update if any dropdown is currently open
    const openDropdowns = this.hudElement.querySelectorAll('select:focus, select:focus-within');
    if (openDropdowns.length > 0) {
      console.log('[MsdHudManager] Skipping refresh - dropdown is open');
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
      // ADDED: Apply selection highlight & badge after render
      this._updateSelectionBadge();
      this._applySelectionHighlight();
      // REMOVED: _decoratePanelHeaders(), filter value restore, collapse/focus logic
      // Reset filter input value after render
      const f = this.hudElement.querySelector('#msd-hud-filter');
      if (f && f.value !== this.state.filterTerm) f.value = this.state.filterTerm;

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

    // ADDED: Calculate proportional font sizes based on base font size
    const baseFontSize = this.state.fontSize;
    const titleFontSize = Math.round(baseFontSize * 1.17); // 14px when base is 12px
    const compactTitleFontSize = Math.round(baseFontSize * 1.0); // 12px when base is 12px
    const sectionFontSize = Math.round(baseFontSize * 1.0); // 12px when base is 12px
    const metricFontSize = Math.round(baseFontSize * 0.92); // 11px when base is 12px
    const controlsFontSize = Math.round(baseFontSize * 0.83); // 10px when base is 12px
    const smallFontSize = Math.round(baseFontSize * 0.75); // 9px when base is 12px
    const tinyFontSize = Math.round(baseFontSize * 0.67); // 8px when base is 12px

    let html = `
      <style>
        #msd-debug-hud .msd-hud-header {
          padding: 8px;
          background: rgba(0,255,255,0.2);
          border-bottom: 1px solid #00ffff;
          display:flex;
          justify-content:space-between;
          align-items:center;
          cursor:grab;
        }
        #msd-debug-hud .msd-hud-title { font-weight:bold; pointer-events:none; }
        #msd-debug-hud .msd-hud-controls { font-size:${controlsFontSize}px; display:flex; gap:4px; }
        #msd-debug-hud .msd-hud-close, #msd-debug-hud .msd-hud-refresh, #msd-debug-hud .msd-hud-menu {
          cursor:pointer; padding:2px 6px; border-radius:3px; pointer-events:auto;
        }
        #msd-debug-hud .msd-hud-close { background:rgba(255,0,0,0.7); }
        #msd-debug-hud .msd-hud-refresh { background:rgba(0,255,0,0.7); }
        #msd-debug-hud .msd-hud-menu { background:rgba(255,170,0,0.7); }
        #msd-debug-hud .msd-hud-panel { padding:${this.state.compactMode ? '4px':'8px'}; border-bottom:1px solid rgba(0,255,255,0.3); }
        #msd-debug-hud .msd-hud-panel.hidden { display:none; }
        #msd-debug-hud .msd-hud-panel h3 {
          margin:0 0 ${this.state.compactMode ? '4px':'8px'} 0;
          color:#ffaa00; font-size:${this.state.compactMode ? compactTitleFontSize : titleFontSize}px;
        }
        #msd-debug-hud .msd-hud-section h4 { margin:6px 0 4px 0; color:#fff; font-size:${sectionFontSize}px; }
        #msd-debug-hud .msd-hud-metric { display:flex; justify-content:space-between; margin:2px 0; font-size:${metricFontSize}px; }
        #msd-debug-hud .msd-hud-metric-name { color:#aaa; }
        #msd-debug-hud .msd-hud-metric-value { color:#0ff; font-weight:bold; }
        #msd-debug-hud .msd-hud-error { border-left:3px solid #ff0000; padding-left:6px; }
        #msd-debug-hud .msd-hud-warning { border-left:3px solid #ffaa00; padding-left:6px; }
        #msd-debug-hud .msd-hud-success { color:#00ff00; font-size:${metricFontSize}px; text-align:center; padding:4px; }
        #msd-debug-hud .msd-hud-summary { text-align:center; font-size:${metricFontSize}px; padding:4px; background:rgba(255,170,0,0.2); }
        #msd-debug-hud .msd-selected { outline:2px solid #ffaa00; background:rgba(255,170,0,0.12)!important; position:relative; }
        #msd-debug-hud .msd-selected::after { content:'●'; position:absolute; top:2px; right:4px; font-size:${tinyFontSize}px; color:#ffaa00; }
        #msd-debug-hud .msd-panel-controls {
          padding:6px 8px;
          background:rgba(0,0,0,0.35);
          border-bottom:1px solid rgba(0,255,255,0.25);
          font-size:${controlsFontSize}px;
        }
        #msd-debug-hud .msd-panel-controls h4 {
          margin:4px 0 6px;
          font-size:${metricFontSize}px;
          color:#ffaa00;
        }
        #msd-debug-hud .msd-panel-toggle-buttons {
          display:flex;
          flex-wrap:wrap;
          gap:6px;
          margin:4px 0 8px;
        }
        #msd-debug-hud .msd-panel-toggle-btn {
          cursor:pointer;
          padding:3px 8px;
          font-size:${controlsFontSize}px;
          border:1px solid #044;
          background:linear-gradient(#022,#011);
          color:#0ff;
          border-radius:14px;
          line-height:1;
          letter-spacing:.5px;
          transition:all .18s;
          position:relative;
          pointer-events:auto;
        }
        #msd-debug-hud .msd-panel-toggle-btn.active {
          background:linear-gradient(#0ff,#066);
          color:#000;
          font-weight:bold;
          box-shadow:0 0 6px #0ff;
          border-color:#0aa;
        }
        #msd-debug-hud .msd-panel-toggle-btn.inactive {
          opacity:.45;
        }
        #msd-debug-hud .msd-panel-toggle-btn:not(.active):hover {
          opacity:.8;
          border-color:#088;
        }
        #msd-debug-hud .msd-panel-toggle-btn:focus {
          outline:1px solid #0ff;
        }
        #msd-debug-hud .msd-panel-controls .msd-panel-meta {
          font-size:${smallFontSize}px;
          opacity:.65;
          margin-top:2px;
        }
        #msd-debug-hud select, #msd-debug-hud button, #msd-debug-hud input {
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        #msd-debug-hud select:hover, #msd-debug-hud button:hover {
          opacity: 0.9;
        }
        /* ADDED: Scale form elements proportionally */
        #msd-debug-hud select, #msd-debug-hud input {
          font-size: ${smallFontSize}px !important;
        }
        #msd-debug-hud button {
          font-size: ${smallFontSize}px !important;
        }
        /* ADDED: Scale footer text */
        #msd-debug-hud .msd-footer {
          font-size: ${controlsFontSize}px;
        }
        #msd-debug-hud .msd-footer-shortcuts {
          font-size: ${smallFontSize}px;
        }
        #msd-debug-hud .msd-footer-debug {
          font-size: ${tinyFontSize}px;
        }
      </style>
    `;
    html += `
      <div class="msd-hud-header">
        <span class="msd-hud-title">MSD v1 Debug HUD</span>
        <div id="msd-selection-badge" style="flex:1;display:flex;justify-content:center;"></div>
        <div class="msd-hud-controls">
          <span class="msd-hud-menu" onclick="window.__msdHudPanelControls?.togglePanelManager?.()" title="Panel Settings">⚙</span>
          <span class="msd-hud-refresh" onclick="window.__msdDebug?.hud?.refresh?.()" title="Refresh">⟳</span>
          <span class="msd-hud-close" onclick="window.__msdDebug?.hud?.hide?.()" title="Close">✕</span>
        </div>
      </div>
    `;
    // REMOVED: filter bar / focus exit button
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

    // FIXED: Correct panel counting in footer with scaled font sizes
    html += `<div class="msd-footer" style="padding: 4px; text-align: center; color: #666; font-size: ${controlsFontSize}px;">
      ${visiblePanelCount}/${renderedPanelCount} panels visible • Updated ${refreshAge}s ago • ${this.state.refreshRate / 1000}s
      <div class="msd-footer-shortcuts" style="margin-top: 2px; opacity: 0.7; font-size: ${smallFontSize}px;">
        Shortcuts: Ctrl+H toggle • Ctrl+R refresh • Ctrl+P panels • Ctrl+K compact • 1-9 toggle panels
      </div>
      <div class="msd-footer-debug" style="margin-top: 1px; opacity: 0.5; font-size: ${tinyFontSize}px;">
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
    // FIXED: Harden against lost context (runtime "this.show is not a function")
    if (!this || !this.state) return;
    const isVisible = !!this.state.visible;
    if (isVisible) {
      if (typeof this.hide === 'function') this.hide();
    } else {
      if (typeof this.show === 'function') this.show();
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
      // FIXED: Be very specific about dragging - only from header title area
      const isValidDragArea = e.target.classList.contains('msd-hud-title') ||
                             (e.target.closest('.msd-hud-header') &&
                              !e.target.closest('.msd-hud-controls') &&
                              !e.target.closest('select') &&
                              !e.target.closest('button') &&
                              !e.target.tagName === 'SELECT' &&
                              !e.target.tagName === 'BUTTON');

      if (!isValidDragArea) {
        return; // Only allow dragging from the title or safe header areas
      }

      e.preventDefault();
      e.stopPropagation(); // Prevent other event handlers

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
    // ADDED: Calculate proportional font sizes for panel controls
    const baseFontSize = this.state.fontSize;
    const smallFontSize = Math.round(baseFontSize * 0.75); // 9px when base is 12px

    let html = `<div class="msd-panel-controls" id="msd-panel-manager" style="display:${this.state.panelManagerOpen ? 'block':'none'};">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <strong style="letter-spacing:.5px;">Panel Settings</strong>
        <div style="display:flex;gap:4px;">
          <button data-action="compact"
            style="font-size:${smallFontSize}px;padding:2px 6px;background:${this.state.compactMode ? '#ffaa00':'#222'};color:${this.state.compactMode ? '#000':'#ccc'};border:1px solid #555;border-radius:4px;cursor:pointer;">
            Compact
          </button>
          <button data-action="reset"
            style="font-size:${smallFontSize}px;padding:2px 6px;background:#333;color:#ccc;border:1px solid #555;border-radius:4px;cursor:pointer;">
            Reset
          </button>
          <button data-action="close"
            style="font-size:${smallFontSize}px;padding:2px 6px;background:#ff4444;color:#fff;border:1px solid #a00;border-radius:4px;cursor:pointer;">
            ✕
          </button>
        </div>
      </div>
      <div class="msd-panel-toggle-buttons">`;

    this.state.panelOrder.forEach(panelName => {
      const enabled = !!this.state.panelVisibility[panelName];
      html += `<button
        class="msd-panel-toggle-btn ${enabled ? 'active':'inactive'}"
        data-panel-toggle="${panelName}"
        aria-pressed="${enabled}"
        title="Toggle ${panelName} panel">
        ${panelName}
      </button>`;
    });

    html += `</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
        <label style="font-size:${smallFontSize}px;opacity:.75;">Refresh:</label>
        <select id="msd-hud-refresh-rate" name="refresh-rate" data-bus-event="refresh-rate:change"
          style="font-size:${smallFontSize}px;background:#111;color:#0ff;border:1px solid #044;padding:2px 4px;border-radius:4px;">
          <option value="1000" ${this.state.refreshRate===1000?'selected':''}>1s</option>
          <option value="2000" ${this.state.refreshRate===2000?'selected':''}>2s</option>
          <option value="5000" ${this.state.refreshRate===5000?'selected':''}>5s</option>
          <option value="10000" ${this.state.refreshRate===10000?'selected':''}>10s</option>
        </select>
        <div style="margin-left:auto;display:flex;gap:4px;">
          <button data-bus-event="width:adjust" data-delta="-20" title="Narrower"
            style="font-size:${smallFontSize}px;padding:2px 6px;background:#222;color:#0ff;border:1px solid #044;border-radius:4px;cursor:pointer;">◀</button>
          <button data-bus-event="width:adjust" data-delta="20" title="Wider"
            style="font-size:${smallFontSize}px;padding:2px 6px;background:#222;color:#0ff;border:1px solid #044;border-radius:4px;cursor:pointer;">▶</button>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding-top:4px;border-top:1px solid rgba(0,255,255,0.2);">
        <label style="font-size:${smallFontSize}px;opacity:.75;">Font Size:</label>
        <button data-bus-event="font:adjust" data-delta="-1" title="Smaller Font"
          style="font-size:${smallFontSize}px;padding:2px 6px;background:#222;color:#0ff;border:1px solid #044;border-radius:4px;cursor:pointer;">A-</button>
        <span style="font-size:${smallFontSize}px;color:#ffaa00;min-width:28px;text-align:center;">${this.state.fontSize}px</span>
        <button data-bus-event="font:adjust" data-delta="1" title="Larger Font"
          style="font-size:${smallFontSize}px;padding:2px 6px;background:#222;color:#0ff;border:1px solid #044;border-radius:4px;cursor:pointer;">A+</button>

        <div style="margin-left:8px;display:flex;align-items:center;gap:4px;">
          <label style="font-size:${smallFontSize}px;opacity:.75;">Scale:</label>
          <button data-bus-event="scale:adjust" data-delta="-0.1" title="Scale Down"
            style="font-size:${smallFontSize}px;padding:2px 6px;background:#222;color:#0ff;border:1px solid #044;border-radius:4px;cursor:pointer;">-</button>
          <span style="font-size:${smallFontSize}px;color:#ffaa00;min-width:32px;text-align:center;">${this.state.hudScale.toFixed(1)}x</span>
          <button data-bus-event="scale:adjust" data-delta="0.1" title="Scale Up"
            style="font-size:${smallFontSize}px;padding:2px 6px;background:#222;color:#0ff;border:1px solid #044;border-radius:4px;cursor:pointer;">+</button>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
        <label style="font-size:${smallFontSize}px;opacity:.75;">Font:</label>
        <select id="msd-hud-font-family" name="font-family" data-bus-event="font-family:change"
          style="font-size:${smallFontSize}px;background:#111;color:#0ff;border:1px solid #044;padding:2px 4px;border-radius:4px;flex:1;">
          <option value="&quot;Antonio&quot;, monospace" ${this.state.fontFamily==='"Antonio", monospace'?'selected':''}>Antonio (LCARS)</option>
          <option value="monospace" ${this.state.fontFamily==='monospace'?'selected':''}>Monospace</option>
          <option value="sans-serif" ${this.state.fontFamily==='sans-serif'?'selected':''}>Sans-serif</option>
          <option value="serif" ${this.state.fontFamily==='serif'?'selected':''}>Serif</option>
          <option value="&quot;Courier New&quot;, monospace" ${this.state.fontFamily==='"Courier New", monospace'?'selected':''}>Courier New</option>
          <option value="&quot;Roboto Mono&quot;, monospace" ${this.state.fontFamily==='"Roboto Mono", monospace'?'selected':''}>Roboto Mono</option>
        </select>
        <button data-bus-event="font:reset" title="Reset Font Settings"
          style="font-size:${smallFontSize}px;padding:2px 6px;background:#333;color:#ccc;border:1px solid #555;border-radius:4px;cursor:pointer;">Reset</button>
      </div>      <div class="msd-panel-meta">
        Click buttons to toggle panels • Order: ${this.state.panelOrder.join(', ')}
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

      // NOTE: Refresh rate, font controls, and width controls now use the event bus system
      // No manual event listeners needed for dropdowns and buttons with data-bus-event
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

  // ADDED: Previously removed show() method (needed before binding in constructor)
  show() {
    if (this.state.visible) return;
    this.state.visible = true;
    this.createHudElement();
    this.startRefresh();
    this._setupResizeHandler();

    // ADDED: Apply font and scale settings after creating HUD element
    this._applyFontAndScale();

    if (window.__msdDebug) {
      window.__msdDebug.hud = {
        manager: this,
        refresh: () => this.refresh(),
        hide: () => this.hide(),
        show: () => this.show(),
        toggle: () => this.toggle(),
        setRefreshRate: (rate) => this.setRefreshRate(rate),
        bus: this.bus
      };
    }
    if (this.state.autoPosition) {
      setTimeout(() => this._autoPositionHud(), 100);
    }
    console.log('[MsdHudManager] HUD activated and exposed globally');
  }

  // ADDED: Previously removed hide() method
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
}
