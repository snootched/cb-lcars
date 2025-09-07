/**
 * Flags Panel for MSD HUD
 * Runtime debug feature management using actual MSD debug interface
 * Based on __msdDebug.debug.enable/disable API
 */

export class FlagsPanel {
  constructor() {
    // Actual MSD debug features
    this.debugFeatures = [
      'anchors', 'bounding_boxes', 'routing', 'performance'
    ];

    // Set up global event handlers once
    this._setupGlobalHandlers();
  }

  _setupGlobalHandlers() {
    // Only set up once globally
    if (window.__msdDebugFlagsPanel) return;

    // Store reference to this instance for the handlers
    const self = this;

    window.__msdDebugFlagsPanel = {
      toggleFeature: function(feature) {
        console.log('[FlagsPanel] toggleFeature called:', feature);

        if (!window.__msdDebug?.debug) {
          console.warn('[FlagsPanel] Debug interface not available');
          return;
        }

        // Get current status and toggle
        const status = window.__msdDebug.debug.status();
        const currentlyEnabled = status[feature];

        if (currentlyEnabled) {
          window.__msdDebug.debug.disable(feature);
        } else {
          window.__msdDebug.debug.enable(feature);
        }

        // Refresh HUD
        if (window.__msdDebug?.hud?.refresh) {
          window.__msdDebug.hud.refresh();
        }
      },

      adjustScale: function(direction) {
        if (!window.__msdDebug?.debug?.status) return;
        const currentScale = window.__msdDebug.debug.status().scale || 1.0;
        const step = 0.1;
        const newScale = direction > 0 ? currentScale + step : currentScale - step;
        const clampedScale = Math.max(0.5, Math.min(3.0, newScale));

        if (window.__msdDebug.debug.setScale) {
          window.__msdDebug.debug.setScale(clampedScale);
        }
      },

      setScale: function(scale) {
        const numScale = parseFloat(scale);
        if (isNaN(numScale)) return;
        const clampedScale = Math.max(0.5, Math.min(3.0, numScale));

        if (window.__msdDebug?.debug?.setScale) {
          window.__msdDebug.debug.setScale(clampedScale);
        }
      },

      refreshDebug: function() {
        if (window.__msdDebug?.debug?.refresh) {
          window.__msdDebug.debug.refresh();
        }
      }
    };
  }

  captureData() {
    const features = {};
    let scale = 1.0;
    let debugReady = false;

    try {
      // Get current debug status from MSD - use helper to avoid console spam
      const status = this._getDebugStatusSilent();
      if (status) {
        debugReady = status.enabled && status.initialized;
        scale = status.scale || 1.0;

        // Extract feature states
        this.debugFeatures.forEach(feature => {
          features[feature] = Boolean(status[feature]);
        });
      } else {
        console.warn('[FlagsPanel] Debug interface not available');
      }

    } catch (e) {
      console.warn('[FlagsPanel] Data capture failed:', e);
    }

    return { features, scale, debugReady };
  }

  _getDebugStatusSilent() {
    try {
      const debug = window.__msdDebug?.debug;
      if (!debug) return null;

      // If there's already a silent method, use it
      if (typeof debug.getStatus === 'function') {
        return debug.getStatus();
      }

      // Otherwise, try to access internal state without triggering console output
      if (debug._state) {
        return { ...debug._state };
      }

      // Last resort: call status() with console suppression
      const originalConsoleTable = console.table;
      const originalConsoleLog = console.log;
      console.table = () => {};
      console.log = () => {};

      let result;
      try {
        result = debug.status();
      } finally {
        console.table = originalConsoleTable;
        console.log = originalConsoleLog;
      }

      return result;
    } catch (e) {
      return null;
    }
  }

  renderHtml(flagsData) {
    let html = '<div class="msd-hud-panel"><h3>Debug Features</h3>';

    const features = flagsData.features || {};
    const scale = flagsData.scale || 1.0;
    const debugReady = flagsData.debugReady || false;

    // Debug status
    if (!debugReady) {
      html += '<div class="msd-hud-section msd-hud-warning"><h4>Status</h4>';
      html += '<div>Debug interface not ready</div></div>';
    } else {
      html += '<div class="msd-hud-section"><h4>Status</h4>';
      html += `<div>Debug ready • Scale: ${scale.toFixed(1)}x</div></div>`;
    }

    // Individual features section
    html += '<div class="msd-hud-section"><h4>Debug Features</h4>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">';

    this.debugFeatures.forEach(feature => {
      const isEnabled = Boolean(features[feature]);
      const displayName = feature.replace('_', ' ');
      html += `<button onclick="window.__msdDebugFlagsPanel?.toggleFeature('${feature}')"
        style="font-size:10px;padding:2px 6px;border:1px solid #444;border-radius:3px;cursor:pointer;
        background:${isEnabled ? '#ff00ff' : '#333'};color:${isEnabled ? '#000' : '#eee'};">
        ${displayName}
      </button>`;
    });

    html += '</div></div>';

    // Scale control
    html += '<div class="msd-hud-section"><h4>Scale Control</h4>';
    html += '<div style="display:flex;gap:4px;align-items:center;margin-bottom:6px;">';

    // +/- buttons and input
    html += `<button onclick="window.__msdDebugFlagsPanel?.adjustScale(-1)"
      style="font-size:10px;padding:2px 6px;border:1px solid #444;border-radius:3px;cursor:pointer;
      background:#333;color:#eee;">-</button>`;

    html += `<input type="number"
      value="${scale.toFixed(1)}"
      min="0.5"
      max="3.0"
      step="0.1"
      onchange="window.__msdDebugFlagsPanel?.setScale(this.value)"
      style="width:60px;font-size:10px;padding:2px 4px;border:1px solid #444;border-radius:3px;
      background:#222;color:#eee;text-align:center;">`;

    html += `<button onclick="window.__msdDebugFlagsPanel?.adjustScale(1)"
      style="font-size:10px;padding:2px 6px;border:1px solid #444;border-radius:3px;cursor:pointer;
      background:#333;color:#eee;">+</button>`;

    html += '</div>';

    // Preset scale buttons
    html += '<div style="display:flex;gap:4px;align-items:center;">';
    [0.8, 1.0, 1.2, 1.5, 2.0].forEach(scaleValue => {
      const isActive = Math.abs(scale - scaleValue) < 0.05;
      html += `<button onclick="window.__msdDebugFlagsPanel?.setScale(${scaleValue})"
        style="font-size:10px;padding:2px 6px;border:1px solid #444;border-radius:3px;cursor:pointer;
        background:${isActive ? '#ffaa00' : '#333'};color:${isActive ? '#000' : '#eee'};">
        ${scaleValue}x
      </button>`;
    });

    html += `<button onclick="window.__msdDebugFlagsPanel?.refreshDebug()"
      style="font-size:10px;padding:2px 6px;border:1px solid #444;border-radius:3px;cursor:pointer;
      background:#333;color:#eee;margin-left:8px;">
      Refresh
    </button>`;
    html += '</div></div>';

    // Status section
    const enabledCount = Object.values(features).filter(Boolean).length;
    html += `<div class="msd-hud-section msd-hud-summary">
      ${enabledCount}/${this.debugFeatures.length} features enabled
    </div>`;

    html += '</div>';
    return html;
  }
}
