/**
 * Enhanced Issues Panel for MSD HUD
 * Unified issue aggregation with smart routing to editors/actions
 * Based on legacy HUD issues panel functionality
 */

export class IssuesPanel {
  constructor() {
    this.issueCategories = {
      validation: { label: 'Validation', color: '#ff6666', icon: '⚠️' },
      routing: { label: 'Routing', color: '#ffaa00', icon: '🔀' },
      performance: { label: 'Performance', color: '#ff9900', icon: '⏱️' },
      debug: { label: 'Debug', color: '#66cfff', icon: '🔧' }
    };
  }

  captureData() {
    const issues = {
      validation: [],
      routing: [],
      performance: [],
      debug: []
    };

    try {
      // Validation issues
      const validationData = window.__msdDebug?.validation?.issues?.() || {};
      if (validationData.errors) {
        validationData.errors.forEach(error => {
          issues.validation.push({
            id: error.overlay || error.anchor || 'unknown',
            type: 'validation',
            severity: 'error',
            message: error.msg || error.message || 'Validation error',
            code: error.code,
            overlay: error.overlay,
            anchor: error.anchor,
            clickAction: 'overlay'
          });
        });
      }
      if (validationData.warnings) {
        validationData.warnings.forEach(warning => {
          issues.validation.push({
            id: warning.overlay || warning.anchor || 'unknown',
            type: 'validation',
            severity: 'warning',
            message: warning.msg || warning.message || 'Validation warning',
            code: warning.code,
            overlay: warning.overlay,
            anchor: warning.anchor,
            clickAction: 'overlay'
          });
        });
      }

      // Routing issues from debug features
      const debugStatus = window.__msdDebug?.debug?.status?.() || {};
      if (debugStatus.enabled) {
        // Check for routing problems (this would need actual routing diagnostics)
        const routing = window.__msdDebug?.routing;
        if (routing?.stats) {
          const stats = routing.stats();
          if (stats.errors && stats.errors > 0) {
            issues.routing.push({
              id: 'routing-errors',
              type: 'routing',
              severity: 'error',
              message: `${stats.errors} routing errors detected`,
              code: 'routing_errors',
              clickAction: 'routing'
            });
          }
        }
      }

      // Performance issues from debug status
      if (debugStatus.performance) {
        // Could check for performance thresholds here
        // This is a placeholder for actual performance monitoring
        const perfData = window.__msdDebug?.getPerf?.() || {};
        if (perfData.timers) {
          Object.entries(perfData.timers).forEach(([key, timer]) => {
            if (timer.avg > 50) { // Example threshold
              issues.performance.push({
                id: key,
                type: 'performance',
                severity: 'warning',
                message: `Slow timer: ${key} (${timer.avg.toFixed(1)}ms avg)`,
                code: 'slow_timer',
                clickAction: 'performance'
              });
            }
          });
        }
      }

      // Debug feature issues
      if (!debugStatus.enabled || !debugStatus.initialized) {
        issues.debug.push({
          id: 'debug-status',
          type: 'debug',
          severity: 'warning',
          message: 'Debug interface not fully initialized',
          code: 'debug_not_ready',
          clickAction: 'debug'
        });
      }

    } catch (e) {
      console.warn('[IssuesPanel] Data capture failed:', e);
      issues.debug.push({
        id: 'capture-error',
        type: 'debug',
        severity: 'error',
        message: `Issue capture failed: ${e.message}`,
        code: 'capture_error',
        clickAction: 'debug'
      });
    }

    return issues;
  }

  renderHtml(issuesData) {
    let html = '<div class="msd-hud-panel"><h3>Issues</h3>';

    // Count total issues
    const allIssues = [];
    Object.values(issuesData).forEach(categoryIssues => {
      allIssues.push(...categoryIssues);
    });

    if (allIssues.length === 0) {
      html += '<div class="msd-hud-section msd-hud-success">✅ No issues detected</div>';
      html += '</div>';
      return html;
    }

    // Summary section
    const errorCount = allIssues.filter(i => i.severity === 'error').length;
    const warningCount = allIssues.filter(i => i.severity === 'warning').length;

    html += `<div class="msd-hud-section msd-hud-summary">
      ${errorCount} errors, ${warningCount} warnings • Click to fix
    </div>`;

    // Issues by category
    Object.entries(issuesData).forEach(([categoryKey, categoryIssues]) => {
      if (categoryIssues.length === 0) return;

      const category = this.issueCategories[categoryKey];
      html += `<div class="msd-hud-section">
        <h4 style="color: ${category.color};">${category.icon} ${category.label} (${categoryIssues.length})</h4>
      `;

      categoryIssues.slice(0, 6).forEach((issue, index) => {
        const severityColor = issue.severity === 'error' ? '#ff6666' : '#ffaa00';
        const issueId = `issue-${categoryKey}-${index}`;

        html += `<div class="msd-hud-metric msd-issue-row"
          data-issue-id="${issue.id}"
          data-issue-action="${issue.clickAction}"
          data-issue-overlay="${issue.overlay || ''}"
          onclick="window.__msdIssuesPanel?.handleIssueClick('${issue.clickAction}', '${issue.id}', '${issue.overlay || ''}')"
          style="cursor: pointer; border-left: 3px solid ${severityColor}; padding-left: 6px; margin: 2px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="msd-hud-metric-name">[${issue.code || issue.type}]</span>
            <span style="color: ${severityColor}; font-size: 10px;">${issue.severity.toUpperCase()}</span>
          </div>
          <div style="font-size: 10px; color: #ccc; margin-top: 2px;">${issue.message}</div>
        </div>`;
      });

      if (categoryIssues.length > 6) {
        html += `<div style="font-size: 9px; opacity: 0.6; text-align: center;">
          ... ${categoryIssues.length - 6} more ${category.label.toLowerCase()} issues
        </div>`;
      }

      html += '</div>';
    });

    // Set up global click handler
    if (!window.__msdIssuesPanel) {
      window.__msdIssuesPanel = {
        handleIssueClick: (action, id, overlay) => {
          console.log('[IssuesPanel] Issue clicked:', { action, id, overlay });

          switch (action) {
            case 'overlay':
              if (overlay && window.__msdDebug?.debug) {
                // Try to highlight the overlay
                console.log(`[IssuesPanel] Highlighting overlay: ${overlay}`);
                // Could integrate with overlay editor here
              }
              break;

            case 'routing':
              console.log('[IssuesPanel] Opening routing diagnostics');
              // Could emit routing focus event
              if (window.__msdDebug?.hud?.refresh) {
                window.__msdDebug.hud.refresh();
              }
              break;

            case 'performance':
              console.log(`[IssuesPanel] Performance issue: ${id}`);
              // Could open performance panel or set thresholds
              break;

            case 'debug':
              console.log('[IssuesPanel] Debug issue clicked');
              // Could try to initialize debug interface
              if (window.__msdDebug?.debug?.refresh) {
                window.__msdDebug.debug.refresh();
              }
              break;
          }
        }
      };
    }

    html += `<style>
      .msd-issue-row:hover {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      }
    </style>`;

    html += '</div>';
    return html;
  }
}
