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

        // FIXED: Use silent status access instead of status() which dumps to console
        const debugManager = window.__msdDebug?.debugManager ||
                           window.__msdDebug?.pipelineInstance?.systemsManager?.debugManager;

        if (!debugManager) {
          console.warn('[FlagsPanel] DebugManager not available');
          return;
        }

        const currentStatus = debugManager.getSnapshot();
        const currentlyEnabled = currentStatus[feature];

        if (currentlyEnabled) {
          window.__msdDebug.debug.disable(feature);
        } else {
          window.__msdDebug.debug.enable(feature);
        }

        // FIXED: Force immediate re-render after state change
        setTimeout(() => {
          try {
            const pipelineInstance = window.__msdDebug?.pipelineInstance;
            if (pipelineInstance?.reRender) {
              console.log('[FlagsPanel] Triggering re-render after', feature, currentlyEnabled ? 'disable' : 'enable');
              pipelineInstance.reRender();
            } else {
              console.warn('[FlagsPanel] No reRender method available on pipeline instance');
            }
          } catch (error) {
            console.warn('[FlagsPanel] Failed to trigger re-render:', error);
          }
        }, 50);

        // Refresh HUD after a delay to show updated state
        setTimeout(() => {
          if (window.__msdDebug?.hud?.refresh) {
            window.__msdDebug.hud.refresh();
          }
        }, 100);
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
    const flags = {};
    const debugFeatures = {};

    try {
      // FIXED: Use centralized silent debug status access
      const debugStatus = window.__msdDebug?.getDebugStatusSilent?.() || {};

      // FIXED: Properly capture debug features and readiness
      Object.assign(debugFeatures, debugStatus);

      // Get current debug flags (legacy support)
      Object.assign(flags, window.__msdDebug?._debugFlags || {});
    } catch (e) {
      console.warn('[FlagsPanel] Data capture failed:', e);
    }

    return { flags, debugFeatures };
  }

  renderHtml(flagsData) {
    let html = '<div class="msd-hud-panel"><h3>Debug Features</h3>';

    // FIXED: Use debugFeatures instead of separate features object
    const debugFeatures = flagsData.debugFeatures || {};
    const scale = debugFeatures.scale || 1.0;
    const debugReady = debugFeatures.initialized || false;

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
      // FIXED: Check debugFeatures instead of features
      const isEnabled = Boolean(debugFeatures[feature]);
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
    // FIXED: Use debugFeatures to count enabled features
    const enabledCount = this.debugFeatures.filter(feature => debugFeatures[feature]).length;
    html += `<div class="msd-hud-section msd-hud-summary">
      ${enabledCount}/${this.debugFeatures.length} features enabled
    </div>`;

    html += '</div>';
    return html;
  }
}

