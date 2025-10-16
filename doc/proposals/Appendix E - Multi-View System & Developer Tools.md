# MSD ApexCharts Enhancement Proposal - Appendix E (Final)

**Version:** 1.0.0  
**Date:** 2025-01-16  
**Status:** Proposed - Appendix (FINAL)  
**Author:** CB-LCARS MSD Team

---

## Appendix E: Multi-View System & Developer Tools

This appendix explores the internal multi-view system for switching between different MSD configurations (tactical, engineering, navigation, etc.) and developer tools to assist with YAML configuration authoring.

---

## E.1 Overview

### E.1.1 Purpose

**Goal:** Enable a single MSD card to contain multiple complete view configurations that users can switch between dynamically, mimicking Star Trek LCARS displays that change based on operational context.

**Not Goals:**
- ❌ Lovelace view integration (unnecessary with `controls` overlays)
- ❌ Visual WYSIWYG editor (too complex, YAML is fine)
- ❌ Panel mode (card mode is sufficient, can defer)

### E.1.2 Core Concept

**Starship LCARS Displays:**

In Star Trek, LCARS interfaces switch between operational modes:
- **Tactical** - Weapons, shields, targeting
- **Engineering** - Warp core, power distribution, systems
- **Navigation** - Helm control, course plotting
- **Operations** - Crew locations, resource management
- **Medical** - Sickbay systems, crew health

Each mode is a complete interface optimized for that purpose.

**MSD Implementation:**

Each "view" is a complete MSD configuration with its own:
- `base_svg` (ship blueprint optimized for that view)
- `overlays` (data visualization specific to that domain)
- `controls` (HA cards relevant to that view)
- `rules` (view-specific conditional logic)
- `decorative` layers (view-specific UI elements)

**Shared State:**

Critical state persists across views:
- ✅ Alert status (Red Alert stays active across views)
- ✅ DataSourceManager (entity subscriptions persist)
- ✅ RulesEngine state (global rules apply to all views)
- ✅ Theme and tokens (consistent styling)

---

## E.2 Multi-View Architecture

### E.2.1 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-View System                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ViewManager                                                 │
│    ├─ View Registry (all defined views)                     │
│    ├─ Active View ID (current view)                         │
│    ├─ Shared State (persists across views)                  │
│    │  ├─ Alert status                                       │
│    │  ├─ DataSourceManager instance                         │
│    │  ├─ RulesEngine instance                               │
│    │  └─ Theme tokens                                       │
│    └─ View Switcher UI                                      │
│                                                              │
│  View Definition (per view)                                  │
│    ├─ Unique ID (tactical, engineering, etc.)              │
│    ├─ Display Name                                          │
│    ├─ Icon (for switcher UI)                               │
│    ├─ Complete MSD Config                                   │
│    │  ├─ base_svg                                           │
│    │  ├─ overlays                                           │
│    │  ├─ controls                                           │
│    │  ├─ decorative                                         │
│    │  └─ view-specific rules                               │
│    └─ Transition preferences                                │
│                                                              │
│  ViewSwitcher UI                                             │
│    ├─ Button bar (LCARS-style)                             │
│    ├─ Dropdown selector                                     │
│    └─ Programmatic switching (rules/services)              │
│                                                              │
│  Transition System (Future: Anime.js v4)                    │
│    ├─ Fade transition                                       │
│    ├─ Slide transition                                      │
│    ├─ LCARS wipe transition                                 │
│    └─ Instant switch                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### E.2.2 Data Flow

```
User Action (click view button)
  │
  ├─> ViewManager.switchView(viewId)
  │
  ├─> Preserve shared state
  │   ├─ Alert status
  │   ├─ DataSourceManager
  │   └─ RulesEngine
  │
  ├─> Deactivate old view
  │   └─ Mark as inactive
  │
  ├─> Activate new view
  │   ├─ Load view config
  │   ├─ Inject new base_svg
  │   ├─ Render new overlays
  │   ├─ Apply view-specific rules
  │   └─ Restore shared state
  │
  ├─> Update ViewSwitcher UI
  │   └─ Highlight active button
  │
  └─> Dispatch event (msd-view-changed)
      └─ Other systems can react
```

---

## E.3 Implementation

### E.3.1 File Structure

```
src/msd/
├── views/
│   ├── ViewManager.js          # Core view management
│   ├── ViewSwitcher.js          # UI switcher component
│   └── ViewTransitions.js       # Transition animations (future)
│
├── pipeline/
│   └── MsdPipeline.js           # ENHANCE: Add view support
│
└── renderer/
    └── AdvancedRenderer.js      # ENHANCE: Handle view switching
```

### E.3.2 ViewManager Implementation

```javascript
// src/msd/views/ViewManager.js

/**
 * @fileoverview ViewManager - Manages multiple MSD views
 * 
 * Handles view registration, switching, and state management.
 * Maintains shared state (alert status, DataSourceManager, RulesEngine) across views.
 * 
 * Key Responsibilities:
 * - Register views from configuration
 * - Switch between views
 * - Preserve shared state across view changes
 * - Provide API for programmatic view switching
 * - Dispatch view change events
 * 
 * @module msd/views/ViewManager
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * ViewManager - Manages multiple MSD views
 * 
 * Provides centralized view management with state persistence.
 * Views share DataSourceManager, RulesEngine, and alert status.
 */
export class ViewManager {
  /**
   * Create a ViewManager
   * 
   * @param {Array<Object>} viewsConfig - Array of view configurations
   * @param {Object} systemsManager - SystemsManager instance (for shared systems)
   */
  constructor(viewsConfig, systemsManager) {
    /**
     * Map of view ID to view object
     * @type {Map<string, Object>}
     */
    this.views = new Map();
    
    /**
     * Currently active view ID
     * @type {string|null}
     */
    this.activeViewId = null;
    
    /**
     * SystemsManager reference for accessing shared systems
     * @type {Object}
     */
    this.systemsManager = systemsManager;
    
    /**
     * Shared state that persists across views
     * This ensures continuity when switching views
     * @type {Object}
     */
    this.sharedState = {
      alertStatus: null,              // Current alert status (red_alert, etc.)
      dataSourceManager: null,        // Entity subscriptions persist
      rulesEngine: null,              // Rule state persists
      svgElementController: null,     // SVG element control persists
      globalTimestamp: Date.now(),    // Initialization timestamp
      userPreferences: {}             // User preferences (zoom, etc.)
    };
    
    // Register views from configuration
    if (viewsConfig && Array.isArray(viewsConfig)) {
      viewsConfig.forEach(view => this.registerView(view));
      cblcarsLog.debug('[ViewManager] Registered views:', this.views.size);
    }
  }
  
  /**
   * Register a view
   * 
   * Adds a view to the registry. Each view must have a unique ID.
   * 
   * @param {Object} viewConfig - View configuration
   * @param {string} viewConfig.id - Unique view identifier
   * @param {string} [viewConfig.name] - Display name
   * @param {string} [viewConfig.icon] - Icon for switcher UI
   * @param {string} [viewConfig.base_svg] - Path to base SVG
   * @param {Array} [viewConfig.overlays] - Overlay configurations
   * @param {Array} [viewConfig.controls] - Control configurations
   * @param {Array} [viewConfig.rules] - View-specific rules
   * @param {Object} [viewConfig.decorative] - Decorative layer config
   */
  registerView(viewConfig) {
    if (!viewConfig.id) {
      cblcarsLog.error('[ViewManager] View missing ID:', viewConfig);
      return;
    }
    
    if (this.views.has(viewConfig.id)) {
      cblcarsLog.warn('[ViewManager] Duplicate view ID, overwriting:', viewConfig.id);
    }
    
    this.views.set(viewConfig.id, {
      id: viewConfig.id,
      name: viewConfig.name || viewConfig.id,
      icon: viewConfig.icon || 'mdi:view-dashboard',
      config: viewConfig,
      active: false,
      loadedAt: null  // Timestamp when view was last loaded
    });
    
    cblcarsLog.debug('[ViewManager] Registered view:', {
      id: viewConfig.id,
      name: viewConfig.name,
      hasBaseSvg: !!viewConfig.base_svg,
      overlayCount: viewConfig.overlays?.length || 0,
      controlCount: viewConfig.controls?.length || 0
    });
  }
  
  /**
   * Switch to a different view
   * 
   * Handles the complete view switching process:
   * 1. Validates view exists
   * 2. Preserves shared state
   * 3. Deactivates old view
   * 4. Activates new view
   * 5. Triggers re-render
   * 6. Dispatches event
   * 
   * @param {string} viewId - View ID to switch to
   * @param {Object} [options={}] - Switch options
   * @param {boolean} [options.skipTransition=false] - Skip transition animation
   * @param {Object} [options.transitionConfig] - Custom transition config
   * @returns {Promise<boolean>} Success status
   */
  async switchView(viewId, options = {}) {
    if (!this.views.has(viewId)) {
      cblcarsLog.error('[ViewManager] Unknown view:', viewId);
      return false;
    }
    
    if (this.activeViewId === viewId) {
      cblcarsLog.debug('[ViewManager] Already on view:', viewId);
      return true;
    }
    
    const oldViewId = this.activeViewId;
    const oldView = oldViewId ? this.views.get(oldViewId) : null;
    const newView = this.views.get(viewId);
    
    cblcarsLog.info('[ViewManager] Switching view:', {
      from: oldViewId || 'none',
      to: viewId,
      skipTransition: options.skipTransition
    });
    
    // Mark old view as inactive
    if (oldView) {
      oldView.active = false;
      
      // Preserve any view-specific state if needed
      // (Currently we keep shared state only)
    }
    
    // Mark new view as active
    newView.active = true;
    newView.loadedAt = Date.now();
    this.activeViewId = viewId;
    
    // Trigger view switch event
    // MsdPipeline will listen to this and re-render
    this._dispatchViewChangeEvent(oldViewId, viewId, options);
    
    // Persist to localStorage for page reload
    this._persistActiveView(viewId);
    
    return true;
  }
  
  /**
   * Get active view
   * 
   * @returns {Object|null} Active view object or null
   */
  getActiveView() {
    if (!this.activeViewId) return null;
    return this.views.get(this.activeViewId);
  }
  
  /**
   * Get active view configuration
   * 
   * @returns {Object|null} Active view config or null
   */
  getActiveViewConfig() {
    const view = this.getActiveView();
    return view ? view.config : null;
  }
  
  /**
   * Get view by ID
   * 
   * @param {string} viewId - View ID
   * @returns {Object|null} View object or null
   */
  getView(viewId) {
    return this.views.get(viewId) || null;
  }
  
  /**
   * List all views
   * 
   * @returns {Array<Object>} Array of view objects
   */
  listViews() {
    return Array.from(this.views.values());
  }
  
  /**
   * Get view IDs
   * 
   * @returns {Array<string>} Array of view IDs
   */
  getViewIds() {
    return Array.from(this.views.keys());
  }
  
  /**
   * Check if view exists
   * 
   * @param {string} viewId - View ID
   * @returns {boolean} True if view exists
   */
  hasView(viewId) {
    return this.views.has(viewId);
  }
  
  /**
   * Set shared state (persists across views)
   * 
   * @param {string} key - State key
   * @param {*} value - State value
   */
  setSharedState(key, value) {
    this.sharedState[key] = value;
    cblcarsLog.debug('[ViewManager] Shared state updated:', key);
  }
  
  /**
   * Get shared state
   * 
   * @param {string} key - State key
   * @returns {*} State value
   */
  getSharedState(key) {
    return this.sharedState[key];
  }
  
  /**
   * Get all shared state
   * 
   * @returns {Object} Complete shared state object
   */
  getAllSharedState() {
    return { ...this.sharedState };
  }
  
  /**
   * Initialize view manager with systems
   * 
   * Called by MsdPipeline to provide shared system instances.
   * 
   * @param {Object} systems - System instances
   * @param {Object} systems.dataSourceManager - DataSourceManager instance
   * @param {Object} systems.rulesEngine - RulesEngine instance
   * @param {Object} systems.svgElementController - SvgElementController instance
   */
  initializeSharedSystems(systems) {
    if (systems.dataSourceManager) {
      this.sharedState.dataSourceManager = systems.dataSourceManager;
    }
    if (systems.rulesEngine) {
      this.sharedState.rulesEngine = systems.rulesEngine;
    }
    if (systems.svgElementController) {
      this.sharedState.svgElementController = systems.svgElementController;
    }
    
    cblcarsLog.debug('[ViewManager] Shared systems initialized:', {
      hasDataSourceManager: !!systems.dataSourceManager,
      hasRulesEngine: !!systems.rulesEngine,
      hasSvgController: !!systems.svgElementController
    });
  }
  
  /**
   * Restore active view from localStorage
   * 
   * @returns {string|null} Restored view ID or null
   */
  restoreActiveView() {
    try {
      const stored = localStorage.getItem('cb-lcars-msd-active-view');
      if (stored && this.hasView(stored)) {
        cblcarsLog.debug('[ViewManager] Restored view from storage:', stored);
        return stored;
      }
    } catch (error) {
      cblcarsLog.warn('[ViewManager] Failed to restore view from storage:', error);
    }
    return null;
  }
  
  /**
   * Persist active view to localStorage
   * 
   * @private
   * @param {string} viewId - View ID to persist
   */
  _persistActiveView(viewId) {
    try {
      localStorage.setItem('cb-lcars-msd-active-view', viewId);
    } catch (error) {
      cblcarsLog.warn('[ViewManager] Failed to persist active view:', error);
    }
  }
  
  /**
   * Dispatch view change event
   * 
   * @private
   * @param {string|null} oldViewId - Previous view ID
   * @param {string} newViewId - New view ID
   * @param {Object} options - Switch options
   */
  _dispatchViewChangeEvent(oldViewId, newViewId, options) {
    window.dispatchEvent(new CustomEvent('msd-view-changed', {
      detail: {
        oldView: oldViewId,
        newView: newViewId,
        timestamp: Date.now(),
        options: options
      }
    }));
    
    cblcarsLog.debug('[ViewManager] Dispatched view-changed event:', {
      oldView: oldViewId,
      newView: newViewId
    });
  }
  
  /**
   * Destroy view manager and clean up
   */
  destroy() {
    this.views.clear();
    this.activeViewId = null;
    this.sharedState = {};
    cblcarsLog.debug('[ViewManager] Destroyed');
  }
}
```

### E.3.3 ViewSwitcher UI Component

```javascript
// src/msd/views/ViewSwitcher.js

/**
 * @fileoverview ViewSwitcher - UI component for switching between views
 * 
 * Renders LCARS-style button bar or dropdown for view selection.
 * 
 * @module msd/views/ViewSwitcher
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { themeTokenResolver } from '../themes/ThemeTokenResolver.js';

/**
 * ViewSwitcher - UI component for view switching
 * 
 * Provides LCARS-styled interface for changing active view.
 */
export class ViewSwitcher {
  /**
   * Create a ViewSwitcher
   * 
   * @param {ViewManager} viewManager - ViewManager instance
   * @param {Object} config - Switcher configuration
   * @param {ShadowRoot} shadowRoot - Shadow root for rendering
   */
  constructor(viewManager, config, shadowRoot) {
    this.viewManager = viewManager;
    this.config = config || {};
    this.shadowRoot = shadowRoot;
    this.container = null;
  }
  
  /**
   * Render view switcher
   * 
   * @param {Element} mountElement - SVG element to mount switcher in
   */
  render(mountElement) {
    const type = this.config.type || 'button_bar';
    
    if (type === 'button_bar') {
      this.container = this._renderButtonBar(mountElement);
    } else if (type === 'dropdown') {
      this.container = this._renderDropdown(mountElement);
    }
    
    // Listen for view changes to update UI
    window.addEventListener('msd-view-changed', (event) => {
      this._updateActiveState(event.detail.newView);
    });
    
    cblcarsLog.debug('[ViewSwitcher] Rendered:', type);
  }
  
  /**
   * Render button bar switcher
   * 
   * @private
   * @param {Element} mountElement - Mount element
   * @returns {Element} Container element
   */
  _renderButtonBar(mountElement) {
    const position = this.config.position || [10, 10];
    const orientation = this.config.orientation || 'horizontal';
    const color = themeTokenResolver.resolve(
      this.config.style?.color || 'colors.accent.primary',
      '#FF9900'
    );
    const fontSize = themeTokenResolver.resolve(
      this.config.style?.font_size || 'typography.fontSize.base',
      14
    );
    
    const views = this.viewManager.listViews();
    const activeView = this.viewManager.getActiveView();
    
    // Create container group
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.id = 'view-switcher';
    group.setAttribute('class', 'view-switcher-button-bar');
    
    // Calculate button dimensions
    const buttonWidth = 120;
    const buttonHeight = 40;
    const gap = 5;
    
    views.forEach((view, index) => {
      // Calculate position
      let x, y;
      if (orientation === 'horizontal') {
        x = position[0] + (index * (buttonWidth + gap));
        y = position[1];
      } else {
        x = position[0];
        y = position[1] + (index * (buttonHeight + gap));
      }
      
      // Create button group
      const buttonGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      buttonGroup.id = `view-button-${view.id}`;
      buttonGroup.setAttribute('class', 'view-button');
      buttonGroup.setAttribute('data-view-id', view.id);
      buttonGroup.style.cursor = 'pointer';
      
      // Button background (LCARS style)
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', buttonWidth);
      rect.setAttribute('height', buttonHeight);
      rect.setAttribute('rx', buttonHeight / 2);  // Rounded ends
      rect.setAttribute('fill', view.active ? color : '#666666');
      rect.setAttribute('class', 'button-background');
      
      // Button text
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x + buttonWidth / 2);
      text.setAttribute('y', y + buttonHeight / 2);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', view.active ? '#000000' : '#FFFFFF');
      text.setAttribute('font-size', fontSize);
      text.setAttribute('font-family', 'Antonio, Helvetica Neue, sans-serif');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('class', 'button-text');
      text.textContent = view.name.toUpperCase();
      
      // Click handler
      buttonGroup.addEventListener('click', () => {
        this.viewManager.switchView(view.id);
      });
      
      // Hover effect
      buttonGroup.addEventListener('mouseenter', () => {
        if (!view.active) {
          rect.setAttribute('fill', '#888888');
        }
      });
      buttonGroup.addEventListener('mouseleave', () => {
        if (!view.active) {
          rect.setAttribute('fill', '#666666');
        }
      });
      
      buttonGroup.appendChild(rect);
      buttonGroup.appendChild(text);
      group.appendChild(buttonGroup);
    });
    
    mountElement.appendChild(group);
    return group;
  }
  
  /**
   * Render dropdown switcher
   * 
   * @private
   * @param {Element} mountElement - Mount element
   * @returns {Element} Container element
   */
  _renderDropdown(mountElement) {
    // TODO: Implement dropdown switcher
    // Uses foreignObject to embed HTML select element
    cblcarsLog.warn('[ViewSwitcher] Dropdown type not yet implemented');
    return null;
  }
  
  /**
   * Update active button state
   * 
   * @private
   * @param {string} activeViewId - Active view ID
   */
  _updateActiveState(activeViewId) {
    if (!this.container) return;
    
    const buttons = this.container.querySelectorAll('.view-button');
    const color = themeTokenResolver.resolve(
      this.config.style?.color || 'colors.accent.primary',
      '#FF9900'
    );
    
    buttons.forEach(button => {
      const viewId = button.getAttribute('data-view-id');
      const rect = button.querySelector('.button-background');
      const text = button.querySelector('.button-text');
      
      if (viewId === activeViewId) {
        rect.setAttribute('fill', color);
        text.setAttribute('fill', '#000000');
      } else {
        rect.setAttribute('fill', '#666666');
        text.setAttribute('fill', '#FFFFFF');
      }
    });
  }
  
  /**
   * Destroy switcher and clean up
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
```

### E.3.4 MsdPipeline Integration

```javascript
// src/msd/pipeline/MsdPipeline.js (enhancement)

import { ViewManager } from '../views/ViewManager.js';
import { ViewSwitcher } from '../views/ViewSwitcher.js';

export class MsdPipeline {
  constructor() {
    // ... existing properties
    this.viewManager = null;  // NEW
    this.viewSwitcher = null;  // NEW
  }
  
  /**
   * Render MSD with multi-view support
   */
  async render(userConfig, hass, mountEl) {
    cblcarsLog.debug('[MsdPipeline] Starting render');
    
    // ... existing initialization
    
    // NEW: Check for multi-view configuration
    if (userConfig.msd?.views && Array.isArray(userConfig.msd.views)) {
      cblcarsLog.info('[MsdPipeline] Multi-view mode detected');
      await this._renderMultiView(userConfig, hass, mountEl);
    } else {
      // Single view mode (existing behavior)
      await this._renderSingleView(userConfig, hass, mountEl);
    }
  }
  
  /**
   * Render multi-view MSD
   * 
   * @private
   * @param {Object} userConfig - User configuration
   * @param {Object} hass - Home Assistant object
   * @param {Element} mountEl - Mount element
   */
  async _renderMultiView(userConfig, hass, mountEl) {
    // Initialize ViewManager
    this.viewManager = new ViewManager(
      userConfig.msd.views,
      this.systemsManager
    );
    
    // Determine initial view
    const defaultViewId = userConfig.msd.default_view;
    const restoredViewId = this.viewManager.restoreActiveView();
    const initialViewId = restoredViewId || 
                         defaultViewId || 
                         userConfig.msd.views[0]?.id;
    
    if (!initialViewId) {
      cblcarsLog.error('[MsdPipeline] No valid view found');
      return;
    }
    
    cblcarsLog.debug('[MsdPipeline] Initial view:', initialViewId);
    
    // Activate initial view
    await this.viewManager.switchView(initialViewId, { skipTransition: true });
    
    // Get active view config
    const activeViewConfig = this.viewManager.getActiveViewConfig();
    
    // Merge active view config with base config
    const mergedConfig = this._mergeViewConfig(userConfig, activeViewConfig);
    
    // Continue with normal rendering pipeline
    await this._continueRender(mergedConfig, hass, mountEl);
    
    // Initialize shared systems with ViewManager
    this.viewManager.initializeSharedSystems({
      dataSourceManager: this.systemsManager.dataSourceManager,
      rulesEngine: this.systemsManager.rulesEngine,
      svgElementController: this.systemsManager.svgElementController
    });
    
    // Render view switcher UI
    if (userConfig.msd.view_switcher?.enabled !== false) {
      this.viewSwitcher = new ViewSwitcher(
        this.viewManager,
        userConfig.msd.view_switcher,
        mountEl
      );
      
      // Render after SVG is ready
      setTimeout(() => {
        const svg = mountEl.querySelector('svg');
        if (svg) {
          this.viewSwitcher.render(svg);
        }
      }, 100);
    }
    
    // Listen for view change events to re-render
    window.addEventListener('msd-view-changed', async (event) => {
      cblcarsLog.info('[MsdPipeline] View changed, re-rendering:', event.detail);
      
      const newViewConfig = this.viewManager.getActiveViewConfig();
      const newMergedConfig = this._mergeViewConfig(userConfig, newViewConfig);
      
      // Re-render with new view config
      await this._reRenderView(newMergedConfig, hass, mountEl);
    });
  }
  
  /**
   * Render single-view MSD (existing behavior)
   * 
   * @private
   * @param {Object} userConfig - User configuration
   * @param {Object} hass - Home Assistant object
   * @param {Element} mountEl - Mount element
   */
  async _renderSingleView(userConfig, hass, mountEl) {
    // Existing single-view rendering logic
    const mergedConfig = await this.configMerger.mergeWithPacks(userConfig, this.hass);
    await this._continueRender(mergedConfig, hass, mountEl);
  }
  
  /**
   * Merge view config with base config
   * 
   * @private
   * @param {Object} baseConfig - Base user configuration
   * @param {Object} viewConfig - View-specific configuration
   * @returns {Object} Merged configuration
   */
  _mergeViewConfig(baseConfig, viewConfig) {
    return {
      ...baseConfig,
      msd: {
        ...baseConfig.msd,
        // View-specific config overrides base
        base_svg: viewConfig.base_svg || baseConfig.msd.base_svg,
        overlays: viewConfig.overlays || baseConfig.msd.overlays || [],
        controls: viewConfig.controls || baseConfig.msd.controls || [],
        decorative: viewConfig.decorative || baseConfig.msd.decorative,
        rules: [
          ...(baseConfig.msd.rules || []),  // Global rules
          ...(viewConfig.rules || [])       // View-specific rules
        ]
      }
    };
  }
  
  /**
   * Re-render view after switch
   * 
   * @private
   * @param {Object} config - Merged configuration
   * @param {Object} hass - Home Assistant object
   * @param {Element} mountEl - Mount element
   */
  async _reRenderView(config, hass, mountEl) {
    // Clear existing overlays/controls (but keep shared systems)
    const svg = mountEl.querySelector('svg');
    if (svg) {
      // Remove old overlays layer
      const overlaysLayer = svg.querySelector('[data-layer="overlays"]');
      if (overlaysLayer) {
        overlaysLayer.remove();
      }
      
      // Remove old controls layer
      const controlsLayer = svg.querySelector('[data-layer="controls"]');
      if (controlsLayer) {
        controlsLayer.remove();
      }
      
      // Remove old base SVG content (but keep SVG element)
      const baseLayer = svg.querySelector('[data-layer="base-svg"]');
      if (baseLayer) {
        baseLayer.innerHTML = '';
      }
    }
    
    // Re-inject new base_svg
    if (config.msd.base_svg) {
      await this.advancedRenderer.loadAndInjectSvg(config.msd.base_svg, mountEl);
      
      // Re-index SVG elements
      if (this.systemsManager.svgElementController) {
        setTimeout(() => {
          this.systemsManager.svgElementController.indexSvgElements();
        }, 100);
      }
    }
    
    // Re-render overlays
    await this.advancedRenderer.renderAllOverlays(
      config.msd.overlays || [],
      this.systemsManager,
      mountEl
    );
    
    // Re-render controls
    if (config.msd.controls) {
      await this.advancedRenderer.renderControls(
        config.msd.controls,
        mountEl,
        hass
      );
    }
    
    // Re-evaluate rules (view-specific + global)
    if (this.systemsManager.rulesEngine) {
      this.systemsManager.rulesEngine.markAllDirty();
      this.systemsManager.rulesEngine.evaluateDirty();
    }
    
    cblcarsLog.debug('[MsdPipeline] View re-render complete');
  }
}
```

---

## E.4 User Configuration

### E.4.1 Complete Multi-View Example

```yaml
type: custom:cb-lcars-msd
pack: tng
theme: lcars-classic

msd:
  # Multi-view configuration
  views:
    # Tactical view
    - id: tactical
      name: "TACTICAL"
      icon: "mdi:target"
      base_svg: "/local/ships/galaxy-class-tactical.svg"
      
      overlays:
        - id: shields
          type: status_grid
          source: shield_power
          tags: ["critical", "tactical"]
          position: [50, 100]
          size: [200, 100]
          style:
            cell_color: "colors.status.info"
            
        - id: weapons
          type: status_grid
          source: weapons_status
          tags: ["critical", "tactical"]
          position: [270, 100]
          size: [200, 100]
          style:
            cell_color: "colors.status.warning"
            
        - id: target_lock
          type: apexchart
          source: targeting_computer
          position: [490, 100]
          size: [400, 200]
          style:
            chart_type: "radar"
            color: "colors.accent.primary"
      
      controls:
        - id: weapons_control
          card:
            type: custom:button-card
            name: "FIRE PHASERS"
            # ... button card config
          position: [50, 320]
          size: [200, 80]
      
      decorative:
        elements:
          - id: tactical_frame
            type: "lcars-frame"
            position: [0, 0]
            size: [1000, 40]
            color: "colors.status.danger"
      
      rules:
        # View-specific rule
        - id: tactical_target_acquired
          when:
            all:
              - entity: binary_sensor.target_lock
                state: "on"
          then:
            overlays:
              target_lock:
                style:
                  color: "colors.status.success"
    
    # Engineering view
    - id: engineering
      name: "ENGINEERING"
      icon: "mdi:engine"
      base_svg: "/local/ships/galaxy-class-engineering.svg"
      
      overlays:
        - id: warp_core_temp
          type: apexchart
          source: warp_core_temperature
          tags: ["critical", "engineering"]
          position: [50, 100]
          size: [400, 200]
          style:
            chart_type: "line"
            color: "colors.accent.primary"
            
        - id: power_distribution
          type: status_grid
          source: power_grid
          tags: ["engineering"]
          position: [470, 100]
          size: [300, 200]
          style:
            cell_color: "colors.accent.secondary"
            
        - id: dilithium_crystals
          type: sparkline
          source: dilithium_integrity
          position: [50, 320]
          size: [300, 80]
          style:
            color: "colors.status.info"
      
      controls:
        - id: ejection_system
          card:
            type: custom:button-card
            name: "EJECT CORE"
            # ... button card config
          position: [50, 420]
          size: [200, 80]
      
      decorative:
        elements:
          - id: engineering_frame
            type: "lcars-frame"
            position: [0, 0]
            size: [1000, 40]
            color: "colors.accent.primary"
      
      rules:
        # View-specific rule
        - id: engineering_core_breach
          when:
            all:
              - entity: sensor.warp_core_temperature
                above: 1500
          then:
            overlays:
              warp_core_temp:
                style:
                  color: "colors.alert.critical"
    
    # Navigation view
    - id: navigation
      name: "NAVIGATION"
      icon: "mdi:compass"
      base_svg: "/local/ships/galaxy-class-navigation.svg"
      
      overlays:
        - id: course_heading
          type: text
          content: "HEADING: {heading}°"
          source: sensor.ship_heading
          position: [50, 100]
          style:
            font_size: "typography.fontSize.2xl"
            color: "colors.accent.primary"
            
        - id: warp_speed
          type: text
          content: "WARP: {warp_speed}"
          source: sensor.warp_speed
          position: [50, 150]
          style:
            font_size: "typography.fontSize.xl"
            color: "colors.accent.secondary"
            
        - id: star_chart
          type: control
          card:
            type: map
            # ... map card config
          position: [300, 100]
          size: [600, 400]
      
      decorative:
        elements:
          - id: navigation_grid
            type: "grid"
            spacing: 20
            color: "colors.ui.border"
            opacity: 0.1
  
  # Default view on load
  default_view: "tactical"
  
  # View switcher UI
  view_switcher:
    enabled: true
    type: "button_bar"
    position: [10, 10]
    orientation: "horizontal"
    style:
      color: "colors.accent.primary"
      font_size: "typography.fontSize.base"
  
  # Global rules (apply to all views)
  rules:
    # Red alert affects all views
    - id: global_red_alert
      when:
        all:
          - entity: input_select.ship_alert_status
            state: "red_alert"
      then:
        overlays:
          all:  # All overlays in all views
            style:
              color: "colors.alert.critical"
              border_color: "colors.alert.critical"
              border_width: "borders.width.thick"
        
        svg_elements:
          class:hull-section:  # SVG elements in base_svg
            fill: "colors.alert.critical"
```

### E.4.2 Programmatic View Switching

**Via RulesEngine:**

```yaml
rules:
  # Auto-switch to tactical on red alert
  - id: red_alert_switch_tactical
    when:
      all:
        - entity: input_select.ship_alert_status
          state: "red_alert"
    then:
      view: "tactical"  # NEW: Switch to tactical view
      overlays:
        all:
          style:
            color: "colors.alert.critical"
  
  # Auto-switch to engineering on warp core breach
  - id: core_breach_switch_engineering
    when:
      all:
        - entity: binary_sensor.warp_core_breach
          state: "on"
    then:
      view: "engineering"
      overlays:
        warp_core_temp:
          style:
            color: "colors.alert.critical"
```

**Via HA Service Call:**

```yaml
# automation.yaml
automation:
  - alias: "Switch to Tactical on Intruder"
    trigger:
      - platform: state
        entity_id: binary_sensor.intruder_detected
        to: "on"
    action:
      - service: browser_mod.command
        data:
          command: "execute"
          code: |
            const msd = document.querySelector('cb-lcars-msd');
            if (msd && msd.viewManager) {
              msd.viewManager.switchView('tactical');
            }
```

**Via JavaScript Console:**

```javascript
// Get MSD card instance
const msd = document.querySelector('cb-lcars-msd');

// Access ViewManager
const viewManager = msd.pipeline?.viewManager;

// Switch view
viewManager?.switchView('engineering');

// List all views
viewManager?.listViews();

// Get active view
viewManager?.getActiveView();
```

---

## E.5 Developer Tools

### E.5.1 Dev Mode Configuration

**Enable in YAML:**

```yaml
type: custom:cb-lcars-msd
pack: tng
theme: lcars-classic

msd:
  # Developer mode settings
  debug:
    dev_mode: true
    show_positions_on_click: true
    show_overlay_bounds: true
    log_level: "debug"  # "debug", "info", "warn", "error"
  
  overlays:
    # ... your overlays
```

### E.5.2 Console Helper Functions

```javascript
// src/utils/cb-lcars-debug.js

/**
 * @fileoverview Developer tools and console helpers
 * 
 * Provides utilities for MSD development and debugging.
 * Accessible via window.cblcars.dev
 * 
 * @module utils/cb-lcars-debug
 */

import { cblcarsLog } from './cb-lcars-logging.js';

/**
 * Developer tools namespace
 */
export const cblcarsDev = {
  /**
   * Get MSD card instance
   * 
   * @returns {Element|null} MSD card element
   */
  getMsd() {
    return document.querySelector('cb-lcars-msd');
  },
  
  /**
   * Get MSD pipeline
   * 
   * @returns {Object|null} MsdPipeline instance
   */
  getPipeline() {
    const msd = this.getMsd();
    return msd?.pipeline || null;
  },
  
  /**
   * Get ViewManager
   * 
   * @returns {Object|null} ViewManager instance
   */
  getViewManager() {
    const pipeline = this.getPipeline();
    return pipeline?.viewManager || null;
  },
  
  /**
   * List all overlays in active view
   * 
   * @returns {Array<Object>} Overlay configurations
   */
  listOverlays() {
    const pipeline = this.getPipeline();
    const model = pipeline?.systemsManager?.getResolvedModel();
    const overlays = model?.overlays || [];
    
    console.table(overlays.map(o => ({
      id: o.id,
      type: o.type,
      position: JSON.stringify(o.position),
      size: JSON.stringify(o.size),
      source: o.source || 'N/A',
      tags: (o.tags || []).join(', ')
    })));
    
    return overlays;
  },
  
  /**
   * Get overlay by ID
   * 
   * @param {string} overlayId - Overlay ID
   * @returns {Object|null} Overlay configuration
   */
  getOverlay(overlayId) {
    const overlays = this.listOverlays();
    const overlay = overlays.find(o => o.id === overlayId);
    
    if (overlay) {
      console.log('Overlay config:', overlay);
      return overlay;
    } else {
      console.warn('Overlay not found:', overlayId);
      return null;
    }
  },
  
  /**
   * Enable click position logging
   * 
   * Click anywhere on MSD to log the position.
   * 
   * @example
   * cblcars.dev.enableClickPositionLogger();
   * // Click on MSD
   * // Console: "Click position: [342, 187]"
   */
  enableClickPositionLogger() {
    const msd = this.getMsd();
    if (!msd) {
      console.error('MSD not found');
      return;
    }
    
    const svg = msd.shadowRoot?.querySelector('svg');
    if (!svg) {
      console.error('SVG not found');
      return;
    }
    
    // Remove existing listener if any
    if (this._clickPositionHandler) {
      svg.removeEventListener('click', this._clickPositionHandler);
    }
    
    // Add new listener
    this._clickPositionHandler = (event) => {
      const rect = svg.getBoundingClientRect();
      const viewBox = svg.viewBox.baseVal;
      
      // Calculate position in viewBox coordinates
      const x = ((event.clientX - rect.left) / rect.width) * viewBox.width;
      const y = ((event.clientY - rect.top) / rect.height) * viewBox.height;
      
      console.log('%cClick position: [%d, %d]', 
        'color: #FF9900; font-weight: bold; font-size: 14px',
        Math.round(x),
        Math.round(y)
      );
      
      console.log('Copy to YAML:', `position: [${Math.round(x)}, ${Math.round(y)}]`);
    };
    
    svg.addEventListener('click', this._clickPositionHandler);
    
    console.log('%cClick position logger enabled. Click anywhere on MSD.',
      'color: #99CC99; font-weight: bold');
  },
  
  /**
   * Disable click position logging
   */
  disableClickPositionLogger() {
    const msd = this.getMsd();
    if (!msd) return;
    
    const svg = msd.shadowRoot?.querySelector('svg');
    if (!svg) return;
    
    if (this._clickPositionHandler) {
      svg.removeEventListener('click', this._clickPositionHandler);
      this._clickPositionHandler = null;
    }
    
    console.log('Click position logger disabled');
  },
  
  /**
   * Highlight overlay bounds
   * 
   * Draws red rectangles around all overlays for visual debugging.
   */
  highlightOverlayBounds() {
    const msd = this.getMsd();
    if (!msd) {
      console.error('MSD not found');
      return;
    }
    
    const svg = msd.shadowRoot?.querySelector('svg');
    if (!svg) {
      console.error('SVG not found');
      return;
    }
    
    // Remove existing debug layer
    const existingLayer = svg.querySelector('#debug-bounds-layer');
    if (existingLayer) {
      existingLayer.remove();
    }
    
    // Create debug layer
    const debugLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    debugLayer.id = 'debug-bounds-layer';
    debugLayer.setAttribute('data-layer', 'debug-bounds');
    
    const overlays = this.listOverlays();
    
    overlays.forEach(overlay => {
      if (!overlay.position || !overlay.size) return;
      
      const [x, y] = overlay.position;
      const [width, height] = overlay.size;
      
      // Draw bounding box
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', width);
      rect.setAttribute('height', height);
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', '#FF0000');
      rect.setAttribute('stroke-width', 2);
      rect.setAttribute('stroke-dasharray', '5,5');
      rect.style.pointerEvents = 'none';
      
      // Add label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x + 5);
      text.setAttribute('y', y + 15);
      text.setAttribute('fill', '#FF0000');
      text.setAttribute('font-size', 12);
      text.setAttribute('font-family', 'monospace');
      text.style.pointerEvents = 'none';
      text.textContent = overlay.id;
      
      debugLayer.appendChild(rect);
      debugLayer.appendChild(text);
    });
    
    svg.appendChild(debugLayer);
    
    console.log('%cOverlay bounds highlighted', 
      'color: #FF0000; font-weight: bold');
  },
  
  /**
   * Clear overlay bounds highlighting
   */
  clearOverlayBounds() {
    const msd = this.getMsd();
    if (!msd) return;
    
    const svg = msd.shadowRoot?.querySelector('svg');
    if (!svg) return;
    
    const debugLayer = svg.querySelector('#debug-bounds-layer');
    if (debugLayer) {
      debugLayer.remove();
    }
    
    console.log('Overlay bounds cleared');
  },
  
  /**
   * Export current configuration as YAML
   * 
   * @returns {string} YAML configuration
   */
  exportConfig() {
    const pipeline = this.getPipeline();
    const config = pipeline?.userConfig;
    
    if (!config) {
      console.error('No configuration available');
      return '';
    }
    
    // Simple YAML serialization (for complex configs, use js-yaml library)
    const yaml = JSON.stringify(config, null, 2)
      .replace(/"([^"]+)":/g, '$1:')  // Remove quotes from keys
      .replace(/"/g, "'");  // Use single quotes
    
    console.log('Current configuration:');
    console.log(yaml);
    
    return yaml;
  },
  
  /**
   * Test rule evaluation
   * 
   * @param {string} ruleId - Rule ID to test
   */
  testRule(ruleId) {
    const pipeline = this.getPipeline();
    const rulesEngine = pipeline?.systemsManager?.rulesEngine;
    
    if (!rulesEngine) {
      console.error('RulesEngine not available');
      return;
    }
    
    const rule = rulesEngine.rules.find(r => r.id === ruleId);
    if (!rule) {
      console.error('Rule not found:', ruleId);
      return;
    }
    
    const result = rulesEngine._evaluateRule(rule);
    
    console.log('Rule:', ruleId);
    console.log('Matched:', result);
    
    if (result && rule.then) {
      console.log('Would apply:', rule.then);
    }
  },
  
  /**
   * Get performance metrics
   * 
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    const pipeline = this.getPipeline();
    const model = pipeline?.systemsManager?.getResolvedModel();
    
    const metrics = {
      overlayCount: model?.overlays?.length || 0,
      controlCount: model?.controls?.length || 0,
      ruleCount: pipeline?.systemsManager?.rulesEngine?.rules?.length || 0,
      viewCount: pipeline?.viewManager?.listViews()?.length || 0,
      activeView: pipeline?.viewManager?.getActiveView()?.id || 'N/A'
    };
    
    console.table(metrics);
    return metrics;
  }
};

// Register on window.cblcars
if (typeof window !== 'undefined') {
  window.cblcars = window.cblcars || {};
  window.cblcars.dev = cblcarsDev;
  
  console.log('%cCB-LCARS Developer Tools loaded', 
    'color: #FF9900; font-weight: bold; font-size: 16px');
  console.log('Access via: window.cblcars.dev');
  console.log('Try: cblcars.dev.listOverlays()');
}
```

### E.5.3 Dev Tools Usage Examples

**Basic Usage:**

```javascript
// List all overlays
cblcars.dev.listOverlays();

// Get specific overlay
cblcars.dev.getOverlay('temp_chart_1');

// Enable click position logging
cblcars.dev.enableClickPositionLogger();
// Click on MSD
// Console: "Click position: [342, 187]"

// Highlight overlay bounds
cblcars.dev.highlightOverlayBounds();

// Clear bounds
cblcars.dev.clearOverlayBounds();

// Export config
const yaml = cblcars.dev.exportConfig();

// Test a rule
cblcars.dev.testRule('red_alert');

// Get performance metrics
cblcars.dev.getPerformanceMetrics();
```

**Multi-View Development:**

```javascript
// Get ViewManager
const vm = cblcars.dev.getViewManager();

// List all views
vm.listViews();

// Switch view
vm.switchView('engineering');

// Get active view
vm.getActiveView();

// Get shared state
vm.getAllSharedState();
```

**Rule Development:**

```javascript
// List all rules
const rules = cblcars.dev.getPipeline().systemsManager.rulesEngine.rules;
console.table(rules.map(r => ({ id: r.id, conditions: r.when })));

// Test specific rule
cblcars.dev.testRule('red_alert');

// Mark all rules dirty and re-evaluate
const rulesEngine = cblcars.dev.getPipeline().systemsManager.rulesEngine;
rulesEngine.markAllDirty();
const results = rulesEngine.evaluateDirty();
console.log('Rule evaluation results:', results);
```

---

## E.6 Documentation Strategy

### E.6.1 Documentation Structure

```
/doc/
├── user-guide/
│   ├── multi-view-system.md         # NEW
│   ├── view-configuration.md         # NEW
│   ├── view-switching.md             # NEW
│   └── developer-tools.md            # NEW
│
├── examples/
│   ├── multi-view/
│   │   ├── complete-ship.yaml        # NEW
│   │   ├── tactical-view.yaml        # NEW
│   │   ├── engineering-view.yaml     # NEW
│   │   ├── navigation-view.yaml      # NEW
│   │   └── README.md                 # NEW
│   │
│   ├── positioning-guide/
│   │   ├── visual-reference.md       # NEW
│   │   ├── grid-overlay.yaml         # NEW
│   │   └── common-layouts.yaml       # NEW
│   │
│   └── templates/
│       ├── temperature-monitor.yaml
│       ├── power-distribution.yaml
│       ├── shield-status.yaml
│       └── README.md
│
├── developer-guide/
│   ├── multi-view-architecture.md    # NEW
│   ├── view-manager-api.md           # NEW
│   ├── dev-tools-reference.md        # NEW
│   └── debugging-tips.md             # NEW
│
└── videos/
    ├── multi-view-setup.mp4          # NEW (future)
    ├── using-dev-tools.mp4           # NEW (future)
    └── positioning-overlays.mp4      # NEW (future)
```

### E.6.2 Key Documentation Files

#### Multi-View System Guide

````markdown
# Multi-View System

## Overview

The Multi-View System allows a single MSD card to contain multiple view configurations that can be switched between dynamically.

## Use Cases

- **Department Dashboards**: Tactical, Engineering, Medical, etc.
- **Context-Aware**: Auto-switch based on ship status
- **Progressive Detail**: Overview → Detailed subsystem views

## Basic Configuration

```yaml
msd:
  views:
    - id: tactical
      name: "TACTICAL"
      base_svg: "/local/ships/galaxy-tactical.svg"
      overlays: [...]
    
    - id: engineering
      name: "ENGINEERING"
      base_svg: "/local/ships/galaxy-engineering.svg"
      overlays: [...]
  
  default_view: "tactical"
  
  view_switcher:
    enabled: true
    type: "button_bar"
    position: [10, 10]
```

## Shared State

State that persists across views:
- Alert status (Red Alert stays active)
- Entity subscriptions (no re-initialization)
- Rule state (global rules apply to all views)

## View-Specific Rules

Each view can have its own rules:

```yaml
views:
  - id: tactical
    rules:
      - id: tactical_shields_low
        when: { ... }
        then: { ... }
```

## Programmatic Switching

Switch views via rules:

```yaml
rules:
  - id: red_alert_tactical
    when:
      all:
        - entity: input_select.ship_alert_status
          state: "red_alert"
    then:
      view: "tactical"  # Auto-switch
```
````

#### Positioning Visual Reference

````markdown
# Overlay Positioning Guide

## ViewBox Coordinates

Standard MSD uses viewBox: `[0, 0, 1000, 600]`

```
┌─────────────────────────────────────────────────────┐
│ (0,0)                                      (1000,0) │
│                                                      │
│                                                      │
│                    [MSD CANVAS]                     │
│                                                      │
│                                                      │
│ (0,600)                                  (1000,600) │
└─────────────────────────────────────────────────────┘
```

## Common Layouts

### Header Bar
```yaml
overlays:
  - id: title
    type: text
    position: [50, 30]  # Top-left
```

### Left Column (3 charts)
```yaml
overlays:
  - id: chart1
    position: [50, 100]
    size: [300, 150]
  
  - id: chart2
    position: [50, 270]
    size: [300, 150]
  
  - id: chart3
    position: [50, 440]
    size: [300, 150]
```

### Right Column (2 large grids)
```yaml
overlays:
  - id: grid1
    position: [370, 100]
    size: [580, 200]
  
  - id: grid2
    position: [370, 320]
    size: [580, 250]
```

## Tips

1. **Use Dev Tools**: `cblcars.dev.enableClickPositionLogger()`
2. **Enable Grid**: Add grid overlay to see spacing
3. **Test Different Sizes**: Resize browser to check responsiveness
````

#### Developer Tools Reference

````markdown
# Developer Tools Reference

## Enabling Dev Mode

```yaml
msd:
  debug:
    dev_mode: true
    show_positions_on_click: true
    show_overlay_bounds: true
```

## Console Commands

### List Overlays
```javascript
cblcars.dev.listOverlays();
```

### Get Overlay Config
```javascript
cblcars.dev.getOverlay('temp_chart_1');
```

### Click Position Logger
```javascript
// Enable
cblcars.dev.enableClickPositionLogger();

// Click on MSD
// Console: "Click position: [342, 187]"

// Disable
cblcars.dev.disableClickPositionLogger();
```

### Highlight Overlay Bounds
```javascript
// Show bounds
cblcars.dev.highlightOverlayBounds();

// Clear bounds
cblcars.dev.clearOverlayBounds();
```

### Multi-View Tools
```javascript
// Get ViewManager
const vm = cblcars.dev.getViewManager();

// List views
vm.listViews();

// Switch view
vm.switchView('engineering');

// Get active view
vm.getActiveView();
```

### Export Configuration
```javascript
const yaml = cblcars.dev.exportConfig();
// Copy to clipboard or save to file
```

### Performance Metrics
```javascript
cblcars.dev.getPerformanceMetrics();
```

## Debugging Tips

1. **Check Console**: Enable `log_level: "debug"` for verbose logging
2. **Inspect State**: Use `cblcars.dev` to inspect runtime state
3. **Test Rules**: Use `cblcars.dev.testRule('rule_id')` to test rules
4. **Visual Debugging**: Use `highlightOverlayBounds()` to see layouts
````

### E.6.3 Example Library Structure

```
/doc/examples/multi-view/
├── README.md                    # Overview of examples
├── complete-ship.yaml           # Full multi-view config
├── tactical-view.yaml           # Tactical view only
├── engineering-view.yaml        # Engineering view only
├── navigation-view.yaml         # Navigation view only
└── screenshots/
    ├── tactical.png
    ├── engineering.png
    └── navigation.png
```

**Complete Ship Example (Excerpt):**

```yaml
# /doc/examples/multi-view/complete-ship.yaml

# USS Enterprise NCC-1701-D
# Complete multi-view MSD configuration

type: custom:cb-lcars-msd
pack: tng
theme: lcars-classic

msd:
  views:
    # ... (full configuration as shown