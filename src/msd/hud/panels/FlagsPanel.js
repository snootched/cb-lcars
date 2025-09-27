import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';
/**
 * [FlagsPanel] Flags panel for MSD HUD
 * 🚩 Runtime debug feature management using actual MSD debug interface
 * Based on __msdDebug.debug.enable/disable API
 */

export class FlagsPanel {
  constructor() {
    // Actual MSD debug features
    this.debugFeatures = [
      'anchors', 'bounding_boxes', 'routing', 'performance'
    ];
  }

  toggleFeature(feature) {
    cblcarsLog.info('[FlagsPanel] 🔄 Toggle feature called:', feature);

    if (!window.__msdDebug?.debug) {
      cblcarsLog.warn('[FlagsPanel] ⚠️ Debug interface not available');
      return;
    }

    // FIXED: Use silent status access instead of status() which dumps to console
    const debugManager = window.__msdDebug?.debugManager ||
                         window.__msdDebug?.pipelineInstance?.systemsManager?.debugManager;

    if (!debugManager) {
      cblcarsLog.warn('[FlagsPanel] ⚠️ DebugManager not available');
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
          cblcarsLog.debug('[FlagsPanel] 🔄 Triggering re-render after', feature, currentlyEnabled ? 'disable' : 'enable');
          pipelineInstance.reRender();
        } else {
          cblcarsLog.warn('[FlagsPanel] ⚠️ No reRender method available on pipeline instance');
        }
      } catch (error) {
        cblcarsLog.warn('[FlagsPanel] ⚠️ Failed to trigger re-render:', error);
      }
    }, 50);

    // Refresh HUD after a delay to show updated state
    setTimeout(() => {
      if (window.__msdDebug?.hud?.refresh) {
        window.__msdDebug.hud.refresh();
      }
    }, 100);
  }

  adjustScale(direction) {
    if (!window.__msdDebug?.debug?.status) {
      cblcarsLog.warn('[FlagsPanel] ⚠️ Debug status not available for scale adjustment');
      return;
    }

    const currentScale = window.__msdDebug.debug.status().scale || 1.0;
    const step = 0.1;
    const newScale = direction > 0 ? currentScale + step : currentScale - step;
    const clampedScale = Math.max(0.5, Math.min(3.0, newScale));

    if (window.__msdDebug.debug.setScale) {
      cblcarsLog.debug(`[FlagsPanel] 🔧 Adjusting scale from ${currentScale.toFixed(1)} to ${clampedScale.toFixed(1)}`);
      window.__msdDebug.debug.setScale(clampedScale);
    } else {
      cblcarsLog.warn('[FlagsPanel] ⚠️ setScale method not available');
    }
  }

  setScale(scale) {
    const numScale = parseFloat(scale);
    if (isNaN(numScale)) {
      cblcarsLog.warn('[FlagsPanel] ⚠️ Invalid scale value:', scale);
      return;
    }
    const clampedScale = Math.max(0.5, Math.min(3.0, numScale));

    if (window.__msdDebug?.debug?.setScale) {
      cblcarsLog.debug(`[FlagsPanel] 📏 Setting scale to ${clampedScale.toFixed(1)}`);
      window.__msdDebug.debug.setScale(clampedScale);
    } else {
      cblcarsLog.warn('[FlagsPanel] ⚠️ setScale method not available');
    }
  }

  refreshDebug() {
    cblcarsLog.debug('[FlagsPanel] ♻️ Refreshing debug interface');
    window.__msdDebug?.debug?.refresh?.();
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
      cblcarsLog.warn('[FlagsPanel] ⚠️ Data capture failed:', e);
    }

    return { flags, debugFeatures };
  }

  /**
   * Clean up panel resources
   */
  destroy() {
    // Clear debug features list
    this.debugFeatures = null;

    cblcarsLog.debug(`[MSD:${this.constructor.name}] Panel cleanup completed`);
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
      html += `<button data-bus-event="flags:toggle" onclick="__msdHudBus('flags:toggle',{feature:'${feature}'})"
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
    html += `<button data-bus-event="flags:scale-adjust" onclick="__msdHudBus('flags:scale-adjust',{dir:-1})" style="font-size:10px;padding:2px 6px;border:1px solid #444;border-radius:3px;cursor:pointer;
      background:#333;color:#eee;">-</button>`;

    html += `<input type="number" id="hud-flags-scale" name="hud-flags-scale"
      value="${scale.toFixed(1)}" min="0.5" max="3.0" step="0.1" data-bus-event="flags:scale-set"
      onchange="__msdHudBus('flags:scale-set',{scale:this.value})"
      style="width:60px;font-size:10px;padding:2px 4px;border:1px solid #444;border-radius:3px;
      background:#222;color:#eee;text-align:center;">`;

    html += `<button data-bus-event="flags:scale-adjust" onclick="__msdHudBus('flags:scale-adjust',{dir:1})" style="font-size:10px;padding:2px 6px;border:1px solid #444;border-radius:3px;cursor:pointer;
      background:#333;color:#eee;">+</button>`;

    html += '</div>';

    // Preset scale buttons
    html += '<div style="display:flex;gap:4px;align-items:center;">';
    [0.8, 1.0, 1.2, 1.5, 2.0].forEach(scaleValue => {
      const isActive = Math.abs(scale - scaleValue) < 0.05;
      html += `<button data-bus-event="flags:scale-set"
        onclick="__msdHudBus('flags:scale-set',{scale:${scaleValue}})"
        style="font-size:10px;padding:2px 6px;border:1px solid #444;border-radius:3px;cursor:pointer;
        background:${isActive ? '#ffaa00' : '#333'};color:${isActive ? '#000' : '#eee'};">
        ${scaleValue}x
      </button>`;
    });

    html += `<button data-bus-event="flags:refresh" onclick="__msdHudBus('flags:refresh')" style="font-size:10px;padding:2px 6px;border:1px solid #444;border-radius:3px;cursor:pointer;
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
