/**
 * Validation display panel for MSD HUD
 * Shows validation errors and warnings with severity formatting
 */

export class ValidationPanel {
  captureData() {
    const issues = [];

    try {
      // FIXED: Handle both browser and Node.js global window access
      const window = (typeof global !== 'undefined' && global.window) ? global.window :
                    (typeof window !== 'undefined') ? window : null;

      const validation = window?.__msdDebug?.validation?.issues?.() || [];
      validation.forEach(issue => {
        issues.push({
          severity: issue.severity || 'error',
          message: issue.message || String(issue),
          code: issue.code || null
        });
      });
    } catch (_) {}

    return { issues, count: issues.length };
  }

  renderHtml(validation) {
    let html = '<div class="msd-hud-panel"><h3>Validation</h3>';

    const issues = validation.issues || [];

    if (issues.length === 0) {
      html += '<div class="msd-hud-section">No validation issues</div>';
    } else {
      html += `<div class="msd-hud-section"><h4>${validation.count || issues.length} issues</h4>`;

      // Show first 8 issues to prevent UI bloat
      const displayIssues = issues.slice(0, 8);

      displayIssues.forEach(issue => {
        const severityClass = issue.severity === 'error' ? 'msd-hud-error' :
                             issue.severity === 'warning' ? 'msd-hud-warning' : '';

        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name ${severityClass}">${issue.severity}</span>
          <span class="msd-hud-metric-value">${issue.message}</span>
        </div>`;
      });

      if (issues.length > 8) {
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">...</span>
          <span class="msd-hud-metric-value">+${issues.length - 8} more</span>
        </div>`;
      }

      html += '</div>';
    }

    html += '</div>';
    return html;
  }
}
