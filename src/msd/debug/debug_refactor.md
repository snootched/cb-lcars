Thank you for the detailed answers and context! I've reviewed your existing animation implementation and the attached files. You've already done excellent work on the animation system with anime.js v4, scopes, and the animation registry. Let's focus on the debug system priority as requested.Let me search for the MSD implementation and debug system to understand the current architecture.Thank you for the clarification and additional context! I can see your existing animation work is quite sophisticated. Looking at your AnimationRegistry.js and the anime.js v4 integration in cb-lcars.js, you're already well ahead of what the proposal suggested. Let me focus on the debug system priority and provide a targeted solution.

## Analysis of Your Current Setup

**Strengths I see:**
- Your anime.js v4 integration in `cb-lcars.js` is already solid with proper scoping
- The AnimationRegistry with semantic hashing is impressive
- MSD pipeline structure appears well-architected
- Your modular design philosophy is sound

**Animation Work Assessment:**
Your existing animation infrastructure is actually more advanced than what the proposal suggested. The AnimationRegistry with semantic comparison and caching is excellent. I'd definitely recommend backlogging animation work as you mentioned - your foundation is already strong.

## Immediate Debug System Solution

Based on your priority to fix the debug timing issue, here's a surgical fix that maintains your existing architecture:

### Phase 1: Debug Timing Fix (Immediate Priority)

```javascript name=src/msd/core/DebugManager.js
/**
 * @file DebugManager.js
 * @description Centralized debug state manager to eliminate timing issues with window.__msdDebug
 */
export class DebugManager {
  constructor() {
    this.state = {
      enabled: false,
      features: {
        anchors: false,
        bounding_boxes: false,
        routing: false,
        performance: false
      },
      scale: 1.0
    };

    this.callbacks = new Set();
    this.initialized = false;
    this.pendingActions = [];
  }

  /**
   * Initialize the debug manager and process any pending actions
   * @param {object} initialState - Initial debug state from config
   */
  init(initialState = {}) {
    // Merge any initial state
    if (initialState.features) {
      Object.assign(this.state.features, initialState.features);
    }
    if (typeof initialState.scale === 'number') {
      this.state.scale = initialState.scale;
    }

    this._updateEnabled();
    this.initialized = true;

    // Process any actions that were queued before initialization
    this.pendingActions.forEach(action => action());
    this.pendingActions = [];

    // Emit initial state
    this._notifyChange('init');
  }

  /**
   * Set a debug feature state
   * @param {string} feature - Feature name
   * @param {boolean} enabled - Enable/disable state
   */
  setFeature(feature, enabled) {
    if (!this.initialized) {
      this.pendingActions.push(() => this.setFeature(feature, enabled));
      return;
    }

    if (this.state.features.hasOwnProperty(feature)) {
      const changed = this.state.features[feature] !== enabled;
      this.state.features[feature] = enabled;

      if (changed) {
        this._updateEnabled();
        this._notifyChange('feature', { feature, enabled });
      }
    }
  }

  /**
   * Set debug scale
   * @param {number} scale - Scale value
   */
  setScale(scale) {
    if (!this.initialized) {
      this.pendingActions.push(() => this.setScale(scale));
      return;
    }

    const newScale = Math.max(0.1, Math.min(3.0, Number(scale) || 1));
    if (newScale !== this.state.scale) {
      this.state.scale = newScale;
      this._notifyChange('scale', { scale: newScale });
    }
  }

  /**
   * Get current debug state snapshot
   * @returns {object} Current state
   */
  getSnapshot() {
    return {
      ...this.state,
      features: { ...this.state.features }
    };
  }

  /**
   * Register callback for state changes
   * @param {Function} callback - Change callback
   * @returns {Function} Unregister function
   */
  onChange(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Check if debug manager is ready
   * @returns {boolean} Ready state
   */
  isReady() {
    return this.initialized;
  }

  /**
   * Update global enabled state
   * @private
   */
  _updateEnabled() {
    this.state.enabled = Object.values(this.state.features).some(v => v);
  }

  /**
   * Notify callbacks of state changes
   * @private
   */
  _notifyChange(type, details = {}) {
    const snapshot = this.getSnapshot();
    this.callbacks.forEach(callback => {
      try {
        callback({ type, details, snapshot });
      } catch (e) {
        console.warn('[DebugManager] Callback error:', e);
      }
    });
  }
}
```

### Phase 2: Integration with Existing MSD Pipeline

```javascript name=src/msd/core/SystemsManager.js
// Patch for existing SystemsManager to include DebugManager
import { DebugManager } from './DebugManager.js';

export class SystemsManager {
  constructor() {
    // ... existing constructor code
    this.debugManager = new DebugManager();
    this._routingReady = false;
  }

  /**
   * Initialize systems with proper ordering
   * @param {object} config - MSD configuration
   */
  async initializeSystems(config) {
    // ... existing initialization code

    // Initialize debug manager early with config
    const debugConfig = config.debug || {};
    this.debugManager.init(debugConfig);

    // ... continue with existing initialization

    // Mark routing as ready when it actually is
    this._routingReady = true;
    this.debugManager._notifyChange('routing', { ready: true });
  }

  /**
   * Check if routing system is ready
   * @returns {boolean} Routing ready state
   */
  isRoutingReady() {
    return this._routingReady;
  }
}
```

### Phase 3: Update MsdApi for Backward Compatibility

```javascript name=src/msd/api/MsdApi.js
// Patch for existing MsdApi to use DebugManager
export class MsdApi {
  constructor(systemsManager) {
    this.systemsManager = systemsManager;
    this.debugManager = systemsManager.debugManager;

    // Maintain backward compatibility
    this._setupLegacyDebugSupport();
  }

  /**
   * New unified debug API
   */
  get debug() {
    return {
      enable: (feature) => this.debugManager.setFeature(feature, true),
      disable: (feature) => this.debugManager.setFeature(feature, false),
      toggle: (feature) => {
        const current = this.debugManager.getSnapshot();
        this.debugManager.setFeature(feature, !current.features[feature]);
      },
      setScale: (scale) => this.debugManager.setScale(scale),
      status: () => this.debugManager.getSnapshot(),
      onChange: (callback) => this.debugManager.onChange(callback),

      // Legacy methods with warnings
      showAnchors: (show) => {
        console.warn('[MsdApi] debug.showAnchors is deprecated, use debug.enable/disable("anchors")');
        this.debugManager.setFeature('anchors', show);
      },
      showBoundingBoxes: (show) => {
        console.warn('[MsdApi] debug.showBoundingBoxes is deprecated, use debug.enable/disable("bounding_boxes")');
        this.debugManager.setFeature('bounding_boxes', show);
      }
    };
  }

  /**
   * Setup backward compatibility with window.__msdDebug
   * @private
   */
  _setupLegacyDebugSupport() {
    // Expose debug manager to window for development
    if (typeof window !== 'undefined') {
      window.__msdDebug = window.__msdDebug || {};
      window.__msdDebug.manager = this.debugManager;
      window.__msdDebug.api = this.debug;

      // Migrate any existing flags
      const existing = window.__msdDebug;
      if (existing.anchors) this.debugManager.setFeature('anchors', true);
      if (existing.bounding_boxes) this.debugManager.setFeature('bounding_boxes', true);
      if (existing.routing) this.debugManager.setFeature('routing', true);
      if (existing.performance) this.debugManager.setFeature('performance', true);
    }
  }
}
```

### Phase 4: Update Debug Renderer to Use DebugManager

```javascript name=src/msd/debug/MsdDebugRenderer.js
// Key patches for existing MsdDebugRenderer
export class MsdDebugRenderer {
  constructor() {
    this.debugManager = null;
    this.routingReady = false;
    this._unsubscribeDebug = null;
  }

  /**
   * Initialize with systems manager
   * @param {SystemsManager} systemsManager
   */
  init(systemsManager) {
    this.debugManager = systemsManager.debugManager;

    // Subscribe to debug state changes
    this._unsubscribeDebug = this.debugManager.onChange((change) => {
      if (change.type === 'routing' && change.details.ready) {
        this.routingReady = true;
        this._rerenderIfNeeded();
      } else if (change.type === 'feature' || change.type === 'scale') {
        this._rerenderIfNeeded();
      }
    });
  }

  /**
   * Render debug overlays using current debug state
   * @param {SVGElement} svgRoot - SVG root element
   * @param {object} model - Current model
   */
  render(svgRoot, model) {
    if (!this.debugManager || !this.debugManager.isReady()) {
      // Early return if debug manager not ready
      return;
    }

    const state = this.debugManager.getSnapshot();

    // Only render if debug is enabled
    if (!state.enabled) {
      this._clearDebugLayer(svgRoot);
      return;
    }

    // Render based on enabled features
    if (state.features.anchors) {
      this._renderAnchors(svgRoot, model, state.scale);
    }

    if (state.features.bounding_boxes) {
      this._renderBoundingBoxes(svgRoot, model, state.scale);
    }

    if (state.features.routing && this.routingReady) {
      this._renderRoutingGuides(svgRoot, model, state.scale);
    }

    if (state.features.performance) {
      this._renderPerformanceMetrics(svgRoot, model);
    }
  }

  /**
   * Re-render if debug state requires it
   * @private
   */
  _rerenderIfNeeded() {
    // Trigger re-render through the pipeline
    // This depends on your existing render trigger mechanism
    if (this._lastRenderContext) {
      this.render(this._lastRenderContext.svg, this._lastRenderContext.model);
    }
  }

  /**
   * Cleanup subscriptions
   */
  destroy() {
    if (this._unsubscribeDebug) {
      this._unsubscribeDebug();
      this._unsubscribeDebug = null;
    }
  }

  // ... rest of existing render methods
}
```

## Questions for You:

1. **Debug Timing Issue Specifics**: Can you describe the exact timing issue you're experiencing? Is it that `window.__msdDebug` is being accessed before the routing system is ready?

2. **Current Debug Usage**: How is debug state currently being set? Through the API, direct `window.__msdDebug` manipulation, or config?

3. **Integration Point**: Where in your existing MSD pipeline initialization would be the best place to inject the DebugManager initialization?

This solution:
- ✅ Fixes timing issues with early initialization and pending action queues
- ✅ Maintains backward compatibility with existing debug usage
- ✅ Is surgical - doesn't disrupt your existing architecture
- ✅ Provides a clean API for future extension
- ✅ Keeps your existing modular design intact



Let me search for the current debug implementation and RouterCore to understand the timing issue better.Let me search for the RouterCore and debug implementation to understand the current timing issue and retry mechanism.Let me examine your MSD implementation to understand the current debug timing issue.Perfect! Based on your clarification, I understand the specific issue - RouterCore not being available when debug is activated, which you've currently worked around with a retry mechanism. Let me create a clean, surgical solution that consolidates the debug system while eliminating the timing issue.

Since you mentioned having a retry mechanism in place, I'll create a solution that properly orchestrates the initialization order and provides an elegant debug API that works with your existing config-driven approach and console interaction.

## Proposed Debug System Refactor

### Core DebugManager (New)

```javascript name=src/msd/core/DebugManager.js
/**
 * @file DebugManager.js
 * @description Centralized debug state manager with proper initialization ordering
 */
export class DebugManager {
  constructor() {
    /** @type {Object} Debug feature states */
    this.state = {
      anchors: false,
      bounding_boxes: false,
      routing: false,
      performance: false,
      scale: 1.0
    };

    /** @type {Set<Function>} Change callbacks */
    this.callbacks = new Set();

    /** @type {boolean} Manager initialization state */
    this.initialized = false;

    /** @type {boolean} RouterCore readiness state */
    this.routerReady = false;

    /** @type {Array<Function>} Actions queued before router ready */
    this.pendingRouterActions = [];

    /** @type {Array<Function>} Actions queued before init */
    this.pendingInitActions = [];
  }

  /**
   * Initialize debug manager with config
   * @param {Object} debugConfig - Debug configuration from MSD config
   */
  init(debugConfig = {}) {
    // Apply initial config
    Object.keys(this.state).forEach(key => {
      if (debugConfig[key] !== undefined) {
        this.state[key] = debugConfig[key];
      }
    });

    this.initialized = true;

    // Process pending init actions
    this.pendingInitActions.forEach(action => action());
    this.pendingInitActions = [];

    // If router is already ready, process router actions too
    if (this.routerReady) {
      this.pendingRouterActions.forEach(action => action());
      this.pendingRouterActions = [];
    }

    this._notifyChange('init');
  }

  /**
   * Mark RouterCore as ready and process pending router-dependent actions
   */
  markRouterReady() {
    this.routerReady = true;

    // Process pending router actions if we're initialized
    if (this.initialized) {
      this.pendingRouterActions.forEach(action => action());
      this.pendingRouterActions = [];
      this._notifyChange('router-ready');
    }
  }

  /**
   * Enable a debug feature
   * @param {string} feature - Feature name (anchors, bounding_boxes, routing, performance)
   */
  enable(feature) {
    this._setFeature(feature, true);
  }

  /**
   * Disable a debug feature
   * @param {string} feature - Feature name
   */
  disable(feature) {
    this._setFeature(feature, false);
  }

  /**
   * Toggle a debug feature
   * @param {string} feature - Feature name
   */
  toggle(feature) {
    this._setFeature(feature, !this.state[feature]);
  }

  /**
   * Set debug scale
   * @param {number} scale - Scale multiplier (0.1 - 3.0)
   */
  setScale(scale) {
    const action = () => {
      const newScale = Math.max(0.1, Math.min(3.0, Number(scale) || 1));
      if (newScale !== this.state.scale) {
        this.state.scale = newScale;
        this._notifyChange('scale', { scale: newScale });
      }
    };

    this._executeWhenReady(action, false); // Scale doesn't need router
  }

  /**
   * Get current debug state snapshot
   * @returns {Object} Current state
   */
  getSnapshot() {
    return {
      ...this.state,
      enabled: this.isAnyEnabled(),
      initialized: this.initialized,
      routerReady: this.routerReady
    };
  }

  /**
   * Check if any debug feature is enabled
   * @returns {boolean} True if any feature enabled
   */
  isAnyEnabled() {
    return ['anchors', 'bounding_boxes', 'routing', 'performance']
      .some(feature => this.state[feature]);
  }

  /**
   * Check if routing debug can be rendered
   * @returns {boolean} True if routing debug is ready
   */
  canRenderRouting() {
    return this.state.routing && this.routerReady;
  }

  /**
   * Register callback for state changes
   * @param {Function} callback - Change callback function
   * @returns {Function} Unregister function
   */
  onChange(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Set feature state with proper queuing
   * @param {string} feature - Feature name
   * @param {boolean} enabled - Enable state
   * @private
   */
  _setFeature(feature, enabled) {
    if (!this.state.hasOwnProperty(feature)) {
      console.warn(`[DebugManager] Unknown debug feature: ${feature}`);
      return;
    }

    const action = () => {
      if (this.state[feature] !== enabled) {
        this.state[feature] = enabled;
        this._notifyChange('feature', { feature, enabled });
      }
    };

    // Routing feature needs router to be ready
    const needsRouter = feature === 'routing';
    this._executeWhenReady(action, needsRouter);
  }

  /**
   * Execute action when dependencies are ready
   * @param {Function} action - Action to execute
   * @param {boolean} needsRouter - Whether action needs RouterCore
   * @private
   */
  _executeWhenReady(action, needsRouter = false) {
    if (!this.initialized) {
      this.pendingInitActions.push(() => this._executeWhenReady(action, needsRouter));
      return;
    }

    if (needsRouter && !this.routerReady) {
      this.pendingRouterActions.push(action);
      return;
    }

    action();
  }

  /**
   * Notify callbacks of state changes
   * @param {string} type - Change type
   * @param {Object} details - Change details
   * @private
   */
  _notifyChange(type, details = {}) {
    const event = {
      type,
      details,
      snapshot: this.getSnapshot()
    };

    this.callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.warn('[DebugManager] Callback error:', error);
      }
    });
  }
}
```

### Updated MsdApi with Debug Integration

```javascript name=src/msd/api/MsdApi.js
/**
 * Enhanced MsdApi with centralized debug management
 */
export class MsdApi {
  constructor() {
    /** @type {DebugManager} */
    this.debugManager = null;
  }

  /**
   * Initialize API with systems manager
   * @param {SystemsManager} systemsManager - Systems manager instance
   */
  init(systemsManager) {
    this.debugManager = systemsManager.debugManager;
    this._setupConsoleApi();
  }

  /**
   * Debug API for both config and interactive use
   */
  get debug() {
    if (!this.debugManager) {
      console.warn('[MsdApi] Debug manager not initialized');
      return {};
    }

    return {
      // Primary API
      enable: (feature) => this.debugManager.enable(feature),
      disable: (feature) => this.debugManager.disable(feature),
      toggle: (feature) => this.debugManager.toggle(feature),
      setScale: (scale) => this.debugManager.setScale(scale),
      status: () => this.debugManager.getSnapshot(),
      onChange: (callback) => this.debugManager.onChange(callback),

      // Convenience methods
      enableAll: () => {
        ['anchors', 'bounding_boxes', 'routing', 'performance']
          .forEach(f => this.debugManager.enable(f));
      },
      disableAll: () => {
        ['anchors', 'bounding_boxes', 'routing', 'performance']
          .forEach(f => this.debugManager.disable(f));
      },

      // Legacy compatibility (with warnings)
      showAnchors: (show) => {
        console.warn('[MsdApi] debug.showAnchors deprecated, use enable/disable("anchors")');
        this.debugManager._setFeature('anchors', show);
      },
      showBoundingBoxes: (show) => {
        console.warn('[MsdApi] debug.showBoundingBoxes deprecated, use enable/disable("bounding_boxes")');
        this.debugManager._setFeature('bounding_boxes', show);
      }
    };
  }

  /**
   * Setup console API for interactive debugging
   * @private
   */
  _setupConsoleApi() {
    if (typeof window === 'undefined') return;

    // Enhanced window.__msdDebug for console interaction
    window.__msdDebug = {
      // Direct access to manager
      manager: this.debugManager,

      // Console-friendly shortcuts
      enable: (feature) => this.debug.enable(feature),
      disable: (feature) => this.debug.disable(feature),
      toggle: (feature) => this.debug.toggle(feature),
      scale: (value) => this.debug.setScale(value),
      status: () => {
        const state = this.debug.status();
        console.table(state);
        return state;
      },

      // Quick toggles
      anchors: () => this.debug.toggle('anchors'),
      boxes: () => this.debug.toggle('bounding_boxes'),
      routing: () => this.debug.toggle('routing'),
      perf: () => this.debug.toggle('performance'),

      // Bulk operations
      all: () => this.debug.enableAll(),
      none: () => this.debug.disableAll(),

      // Help
      help: () => {
        console.log(`
MSD Debug Console Commands:
  __msdDebug.enable('feature')   - Enable debug feature
  __msdDebug.disable('feature')  - Disable debug feature
  __msdDebug.toggle('feature')   - Toggle debug feature
  __msdDebug.scale(1.5)          - Set debug scale
  __msdDebug.status()            - Show current state

Quick toggles:
  __msdDebug.anchors()   - Toggle anchor points
  __msdDebug.boxes()     - Toggle bounding boxes
  __msdDebug.routing()   - Toggle routing guides
  __msdDebug.perf()      - Toggle performance metrics

Bulk operations:
  __msdDebug.all()       - Enable all features
  __msdDebug.none()      - Disable all features

Features: anchors, bounding_boxes, routing, performance
        `);
      }
    };

    // Show help on first load
    console.log('[MSD Debug] Console API ready. Type __msdDebug.help() for commands.');
  }
}
```

### Integration with Pipeline Core

```javascript name=src/msd/core/PipelineCore.js
// Add these imports and integration points to your existing PipelineCore

import { DebugManager } from './DebugManager.js';

export class PipelineCore {
  constructor() {
    // ... existing constructor code

    // Initialize debug manager early
    this.debugManager = new DebugManager();
  }

  /**
   * Initialize MSD pipeline with proper ordering
   * @param {Object} config - MSD configuration
   */
  async initializePipeline(config) {
    // ... existing early initialization code

    // 1. Initialize debug manager with config
    const debugConfig = config.debug || {};
    this.debugManager.init(debugConfig);

    // ... existing middle initialization code

    // 2. Initialize RouterCore
    await this.initializeRouter(config);

    // 3. Mark router ready for debug system
    this.debugManager.markRouterReady();

    // ... rest of existing initialization

    // 4. Initialize API with debug manager
    if (this.api) {
      this.api.init(this);
    }
  }

  /**
   * Get systems manager interface for components
   * @returns {Object} Systems manager interface
   */
  getSystemsManager() {
    return {
      debugManager: this.debugManager,
      router: this.router,
      // ... other systems
    };
  }
}
```

### Updated Debug Renderer Integration

```javascript name=src/msd/debug/MsdDebugRenderer.js
// Key patches for existing debug renderer

export class MsdDebugRenderer {
  constructor() {
    /** @type {DebugManager} */
    this.debugManager = null;
    /** @type {Function} */
    this.unsubscribeDebug = null;
    /** @type {Object} */
    this.lastRenderContext = null;
  }

  /**
   * Initialize with systems manager
   * @param {Object} systemsManager - Systems manager
   */
  init(systemsManager) {
    this.debugManager = systemsManager.debugManager;

    // Subscribe to debug changes for reactive rendering
    this.unsubscribeDebug = this.debugManager.onChange((event) => {
      if (event.type === 'feature' || event.type === 'scale' || event.type === 'router-ready') {
        this._scheduleRerender();
      }
    });
  }

  /**
   * Render debug overlays - main entry point
   * @param {SVGElement} svgRoot - SVG root element
   * @param {Object} context - Render context with model, anchors, etc.
   */
  render(svgRoot, context) {
    // Store context for reactive re-renders
    this.lastRenderContext = { svgRoot, context };

    if (!this.debugManager || !this.debugManager.initialized) {
      return; // Exit early if debug not ready
    }

    const state = this.debugManager.getSnapshot();

    // Clear existing debug layer
    this._clearDebugLayer(svgRoot);

    // Exit early if no features enabled
    if (!state.enabled) {
      return;
    }

    // Get or create debug layer
    const debugLayer = this._getDebugLayer(svgRoot);

    // Render enabled features
    if (state.anchors) {
      this._renderAnchors(debugLayer, context, state.scale);
    }

    if (state.bounding_boxes) {
      this._renderBoundingBoxes(debugLayer, context, state.scale);
    }

    if (state.routing && state.routerReady) {
      this._renderRoutingGuides(debugLayer, context, state.scale);
    }

    if (state.performance) {
      this._renderPerformanceMetrics(debugLayer, context);
    }
  }

  /**
   * Get or create debug layer group
   * @param {SVGElement} svgRoot - SVG root
   * @returns {SVGGElement} Debug layer group
   * @private
   */
  _getDebugLayer(svgRoot) {
    let debugLayer = svgRoot.querySelector('#msd-debug-layer');
    if (!debugLayer) {
      debugLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      debugLayer.id = 'msd-debug-layer';
      debugLayer.setAttribute('class', 'msd-debug-layer');
      svgRoot.appendChild(debugLayer);
    }
    return debugLayer;
  }

  /**
   * Clear debug layer
   * @param {SVGElement} svgRoot - SVG root
   * @private
   */
  _clearDebugLayer(svgRoot) {
    const debugLayer = svgRoot.querySelector('#msd-debug-layer');
    if (debugLayer) {
      debugLayer.innerHTML = '';
    }
  }

  /**
   * Schedule a re-render on next frame
   * @private
   */
  _scheduleRerender() {
    if (this.lastRenderContext) {
      requestAnimationFrame(() => {
        this.render(this.lastRenderContext.svgRoot, this.lastRenderContext.context);
      });
    }
  }

  /**
   * Cleanup subscriptions
   */
  destroy() {
    if (this.unsubscribeDebug) {
      this.unsubscribeDebug();
      this.unsubscribeDebug = null;
    }
  }

  // ... rest of your existing render methods (_renderAnchors, _renderBoundingBoxes, etc.)
}
```

## Benefits of This Solution

1. **Eliminates Timing Issues**: DebugManager properly queues actions until RouterCore is ready
2. **Maintains Existing Usage**: Config-driven debug still works, console interaction enhanced
3. **Surgical Changes**: Minimal disruption to your existing architecture
4. **Reactive Rendering**: Debug changes automatically trigger re-renders
5. **Clean API**: Unified debug interface for config, console, and future HUD integration
6. **Future-Ready**: Easy to extend for HUD integration when ready

## Usage Examples

```yaml
# Config-driven (existing approach)
msd:
  debug:
    anchors: true
    routing: true
    scale: 1.2
```

```javascript
// Console interaction (enhanced)
__msdDebug.routing()        // Toggle routing debug
__msdDebug.scale(1.5)       // Set debug scale
__msdDebug.status()         // Show current state
__msdDebug.all()            // Enable all debug features
```

This solution eliminates your retry mechanism while providing a clean, extensible foundation for future HUD integration. Would you like me to adjust any part of this approach?



Perfect! Those path adjustments make complete sense for your modular architecture. Here are the corrected file paths and any necessary import adjustments:

## Corrected File Paths

### Core Debug Manager
```javascript name=src/msd/debug/DebugManager.js
/**
 * @file DebugManager.js
 * @description Centralized debug state manager with proper initialization ordering
 */
export class DebugManager {
  constructor() {
    /** @type {Object} Debug feature states */
    this.state = {
      anchors: false,
      bounding_boxes: false,
      routing: false,
      performance: false,
      scale: 1.0
    };

    /** @type {Set<Function>} Change callbacks */
    this.callbacks = new Set();

    /** @type {boolean} Manager initialization state */
    this.initialized = false;

    /** @type {boolean} RouterCore readiness state */
    this.routerReady = false;

    /** @type {Array<Function>} Actions queued before router ready */
    this.pendingRouterActions = [];

    /** @type {Array<Function>} Actions queued before init */
    this.pendingInitActions = [];
  }

  // ... rest of the DebugManager implementation remains the same
}
```

### Updated MsdApi with Corrected Imports
```javascript name=src/msd/api/MsdApi.js
/**
 * Enhanced MsdApi with centralized debug management
 */
export class MsdApi {
  constructor() {
    /** @type {DebugManager} */
    this.debugManager = null;
  }

  /**
   * Initialize API with systems manager
   * @param {SystemsManager} systemsManager - Systems manager instance
   */
  init(systemsManager) {
    this.debugManager = systemsManager.debugManager;
    this._setupConsoleApi();
  }

  // ... rest of the MsdApi implementation remains the same
}
```

### Updated Pipeline Core with Corrected Imports
```javascript name=src/msd/pipeline/PipelineCore.js
// Import DebugManager from debug directory
import { DebugManager } from '../debug/DebugManager.js';

export class PipelineCore {
  constructor() {
    // ... existing constructor code

    // Initialize debug manager early
    this.debugManager = new DebugManager();
  }

  /**
   * Initialize MSD pipeline with proper ordering
   * @param {Object} config - MSD configuration
   */
  async initializePipeline(config) {
    // ... existing early initialization code

    // 1. Initialize debug manager with config
    const debugConfig = config.debug || {};
    this.debugManager.init(debugConfig);

    // ... existing middle initialization code

    // 2. Initialize RouterCore
    await this.initializeRouter(config);

    // 3. Mark router ready for debug system
    this.debugManager.markRouterReady();

    // ... rest of existing initialization

    // 4. Initialize API with debug manager
    if (this.api) {
      this.api.init(this);
    }
  }

  /**
   * Get systems manager interface for components
   * @returns {Object} Systems manager interface
   */
  getSystemsManager() {
    return {
      debugManager: this.debugManager,
      router: this.router,
      // ... other systems
    };
  }
}
```

### Updated Debug Renderer (Already in Correct Location)
```javascript name=src/msd/debug/MsdDebugRenderer.js
// Import DebugManager if needed (should be available via systemsManager)

export class MsdDebugRenderer {
  constructor() {
    /** @type {DebugManager} */
    this.debugManager = null;
    /** @type {Function} */
    this.unsubscribeDebug = null;
    /** @type {Object} */
    this.lastRenderContext = null;
  }

  // ... rest of the MsdDebugRenderer implementation remains the same
}
```

## Import Chain Summary

With your corrected paths, the import structure would be:

```
src/msd/
├── pipeline/
│   └── PipelineCore.js         → imports from ../debug/DebugManager.js
├── debug/
│   ├── DebugManager.js         → standalone, no pipeline imports
│   └── MsdDebugRenderer.js     → receives DebugManager via systemsManager
└── api/
    └── MsdApi.js               → receives DebugManager via systemsManager
```

This maintains clean separation where:
- **Pipeline** orchestrates and can import from other modules
- **Debug** components are self-contained
- **API** receives dependencies via injection rather than direct imports

The architecture follows your modular design philosophy while eliminating the RouterCore timing issue. The DebugManager will properly queue actions until RouterCore is ready, removing the need for your current retry mechanism.

Ready to implement when you are!
