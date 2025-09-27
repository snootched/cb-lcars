import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';
/**
 * [ValidationPanel] Validation monitoring panel for MSD HUD
 * ✅ Displays validation errors and warnings with overlay highlighting
 */

export class ValidationPanel {
  captureData() {
    const errors = [];
    const warnings = [];

    try {
      cblcarsLog.debug('[ValidationPanel] 📋 Capturing validation data');
      // FIXED: Use centralized silent debug status access
      const debugStatus = window.__msdDebug?.getDebugStatusSilent?.() || {};
      let validationData = {};

      if (debugStatus.enabled && window.__msdDebug?.validation?.issues) {
        validationData = window.__msdDebug.validation.issues() || {};
        cblcarsLog.debug('[ValidationPanel] 🔍 Retrieved validation data from debug interface');
      } else {
        // Fallback: try direct access without debug interface
        validationData = window.__msdDebug?.pipelineInstance?.getValidationIssues?.() || {};
        cblcarsLog.debug('[ValidationPanel] 🔄 Using fallback validation data access');
      }

      if (validationData.errors) {
        validationData.errors.forEach(error => {
          errors.push({
            code: error.code || 'unknown',
            severity: error.severity || 'error',
            message: error.msg || error.message || 'Unknown error',
            overlay: error.overlay,
            anchor: error.anchor
          });
        });
        cblcarsLog.debug(`[ValidationPanel] ❌ Processed ${validationData.errors.length} validation errors`);
      }

      if (validationData.warnings) {
        validationData.warnings.forEach(warning => {
          warnings.push({
            code: warning.code || 'unknown',
            severity: warning.severity || 'warning',
            message: warning.msg || warning.message || 'Unknown warning',
            overlay: warning.overlay,
            anchor: warning.anchor
          });
        });
        cblcarsLog.debug(`[ValidationPanel] ⚠️ Processed ${validationData.warnings.length} validation warnings`);
      }

      const totalIssues = errors.length + warnings.length;
      if (totalIssues === 0) {
        cblcarsLog.debug('[ValidationPanel] ✅ No validation issues found');
      } else {
        cblcarsLog.info(`[ValidationPanel] 📊 Found ${errors.length} errors and ${warnings.length} warnings`);
      }
    } catch (e) {
      cblcarsLog.warn('[ValidationPanel] ⚠️ Data capture failed:', e);
    }

    return { errors, warnings };
  }

  /**
   * Clean up panel resources
   */
  destroy() {
    // No specific resources to clean up for this panel
    cblcarsLog.debug(`[MSD:${this.constructor.name}] Panel cleanup completed`);
  }

  renderHtml(validation) {
    let html = '<div class="msd-hud-panel"><h3>Validation</h3>';

    // Errors section
    const errors = validation.errors || [];
    if (errors.length > 0) {
      html += '<div class="msd-hud-section msd-hud-errors"><h4>Errors</h4>';
      errors.slice(0, 6).forEach(error => {
        html += `<div class="msd-hud-metric msd-hud-error"
          data-select-type="${error.overlay ? 'overlay':'anchor'}"
          data-select-id="${error.overlay || error.anchor || error.code}"
          onclick="__msdHudBus('select:set',{type:'${error.overlay ? 'overlay':'anchor'}',id:'${error.overlay || error.anchor || error.code}',source:'validation'})"
        >
          <span class="msd-hud-metric-name">${error.code}</span>
          <span class="msd-hud-metric-value">${error.message}</span>
        </div>`;
        if (error.overlay) {
          html += `<div class="msd-hud-metric-detail">Overlay: ${error.overlay}</div>`;
        }
        if (error.anchor) {
          html += `<div class="msd-hud-metric-detail">Anchor: ${error.anchor}</div>`;
        }
      });
      html += '</div>';
    }

    // Warnings section
    const warnings = validation.warnings || [];
    if (warnings.length > 0) {
      html += '<div class="msd-hud-section msd-hud-warnings"><h4>Warnings</h4>';
      warnings.slice(0, 6).forEach(warning => {
        html += `<div class="msd-hud-metric msd-hud-warning"
          data-select-type="${warning.overlay ? 'overlay':'anchor'}"
          data-select-id="${warning.overlay || warning.anchor || warning.code}"
          onclick="__msdHudBus('select:set',{type:'${warning.overlay ? 'overlay':'anchor'}',id:'${warning.overlay || warning.anchor || warning.code}',source:'validation'})"
        >
          <span class="msd-hud-metric-name">${warning.code}</span>
          <span class="msd-hud-metric-value">${warning.message}</span>
        </div>`;
        if (warning.overlay) {
          html += `<div class="msd-hud-metric-detail">Overlay: ${warning.overlay}</div>`;
        }
      });
      html += '</div>';
    }

    // Status section
    const totalIssues = errors.length + warnings.length;
    if (totalIssues === 0) {
      html += '<div class="msd-hud-section msd-hud-success">✅ No validation issues</div>';
    } else {
      html += `<div class="msd-hud-section msd-hud-summary">
        ${errors.length} errors, ${warnings.length} warnings
      </div>`;
    }

    html += '</div>';
    return html;
  }
}
