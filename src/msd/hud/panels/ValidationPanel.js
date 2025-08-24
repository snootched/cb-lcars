/**
 * Validation monitoring panel for MSD HUD
 * Displays validation errors and warnings with overlay highlighting
 */

export class ValidationPanel {
  captureData() {
    const errors = [];
    const warnings = [];

    try {
    // FIXED: Handle both browser and Node.js global window access
    const window = (typeof global !== 'undefined' && global.window) ? global.window :
                  (typeof window !== 'undefined') ? window : null;

      const validationData = window.__msdDebug?.validation?.issues?.() || {};

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
      }
    } catch (_) {}

    return { errors, warnings };
  }

  renderHtml(validation) {
    let html = '<div class="msd-hud-panel"><h3>Validation</h3>';

    // Errors section
    const errors = validation.errors || [];
    if (errors.length > 0) {
      html += '<div class="msd-hud-section msd-hud-errors"><h4>Errors</h4>';
      errors.slice(0, 6).forEach(error => {
        html += `<div class="msd-hud-metric msd-hud-error">
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
        html += `<div class="msd-hud-metric msd-hud-warning">
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
