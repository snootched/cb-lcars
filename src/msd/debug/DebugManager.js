import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

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

    // Add debouncing properties
    this._notifyTimeout = null;
    this._pendingNotification = null;
  }

  /**
   * Initialize debug manager with config
   * @param {Object} debugConfig - Debug configuration from MSD config
   */
  init(debugConfig = {}) {
    // REDUCED: Only log if debug is actually enabled
    if (debugConfig && Object.keys(debugConfig).length > 0) {
      cblcarsLog.debug('[DebugManager] Initializing with config:', debugConfig);
    }

    // FIXED: Apply initial config - handle both flat and nested structures
    if (debugConfig.overlays) {
      // Handle nested structure: debug.overlays.anchors
      Object.keys(this.state).forEach(key => {
        if (key !== 'scale' && debugConfig.overlays[key] !== undefined) {
          this.state[key] = debugConfig.overlays[key];
        }
      });
    } else {
      // Handle flat structure: debug.anchors
      Object.keys(this.state).forEach(key => {
        if (debugConfig[key] !== undefined) {
          this.state[key] = debugConfig[key];
        }
      });
    }

    // Handle scale separately
    if (debugConfig.scale !== undefined) {
      this.state.scale = debugConfig.scale;
    }

    this.initialized = true;

    // REDUCED: Only log state if features are enabled
    const hasEnabledFeatures = this.isAnyEnabled();
    if (hasEnabledFeatures) {
      cblcarsLog.debug('[DebugManager] State after config init:', this.state);
    }

    // Process pending init actions
    this.pendingInitActions.forEach(action => action());
    this.pendingInitActions = [];

    // If router is already ready, process router actions too
    if (this.routerReady) {
      this.pendingRouterActions.forEach(action => action());
      this.pendingRouterActions = [];
    }

    this._scheduleNotification('init');
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
      this._scheduleNotification('router-ready');
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
        this._scheduleNotification('scale', { scale: newScale });
      }
    };

    this._executeWhenReady(action, false); // Scale doesn't need router
  }

  /**
   * Get current debug state snapshot (silent - no console output)
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
   * Get status with console output (for manual debugging)
   * @returns {Object} Current state
   */
  status() {
    const snapshot = this.getSnapshot();
    cblcarsLog.table(snapshot);
    return snapshot;
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
   * Enable multiple features at once
   * @param {string[]} features - Array of feature names
   */
  enableMultiple(features) {
    features.forEach(feature => this.enable(feature));
  }

  /**
   * Disable multiple features at once
   * @param {string[]} features - Array of feature names
   */
  disableMultiple(features) {
    features.forEach(feature => this.disable(feature));
  }

  /**
   * Get available debug features
   * @returns {string[]} Array of feature names
   */
  getAvailableFeatures() {
    return Object.keys(this.state).filter(key => key !== 'scale');
  }

  /**
   * Check if a specific feature is enabled
   * @param {string} feature - Feature name
   * @returns {boolean} True if enabled
   */
  isEnabled(feature) {
    return Boolean(this.state[feature]);
  }

  /**
   * Schedule debounced notification to prevent excessive callbacks
   * @param {string} type - Change type
   * @param {Object} details - Change details
   * @private
   */
  _scheduleNotification(type, details) {
    // Clear existing timeout
    if (this._notifyTimeout) {
      clearTimeout(this._notifyTimeout);
    }

    // Store pending notification
    this._pendingNotification = { type, details };

    // Schedule debounced notification (~60fps)
    this._notifyTimeout = setTimeout(() => {
      if (this._pendingNotification) {
        this._notifyChange(this._pendingNotification.type, this._pendingNotification.details);
        this._pendingNotification = null;
      }
      this._notifyTimeout = null;
    }, 16);
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
      snapshot: this.getSnapshot(),
      timestamp: Date.now()
    };

    this.callbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        cblcarsLog.warn('[DebugManager] Callback error:', error);
      }
    });
  }

  /**
   * Set feature state with proper queuing
   * @param {string} feature - Feature name
   * @param {boolean} enabled - Enable state
   * @private
   */
  _setFeature(feature, enabled) {
    if (!this.state.hasOwnProperty(feature) || feature === 'scale') {
      cblcarsLog.warn(`[DebugManager] Invalid debug feature: ${feature}`);
      return;
    }

    const action = () => {
      if (this.state[feature] !== enabled) {
        cblcarsLog.debug(`[DebugManager] Setting ${feature} to ${enabled}`);
        this.state[feature] = enabled;
        this._scheduleNotification('feature', { feature, enabled });

        // FIXED: Trigger immediate re-render when feature state changes
        setTimeout(() => {
          try {
            const pipelineInstance = window.__msdDebug?.pipelineInstance;
            if (pipelineInstance?.reRender) {
              cblcarsLog.debug(`[DebugManager] Auto re-render after ${feature} ${enabled ? 'enable' : 'disable'}`);
              pipelineInstance.reRender();
            }
          } catch (error) {
            cblcarsLog.warn('[DebugManager] Auto re-render failed:', error);
          }
        }, 5);
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
}