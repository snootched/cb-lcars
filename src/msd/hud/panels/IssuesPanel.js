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

  handleIssueClick(action, id, overlay) {
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
        console.log('[IssuesPanel] Debug issue clicked - attempting to initialize debug interface');
        // Try to initialize debug interface
        if (window.__msdDebug?.debug?.refresh) {
          window.__msdDebug.debug.refresh();
        }
        break;

      // ADDED: New action for enabling debug features
      case 'enable-features':
        console.log('[IssuesPanel] Enabling basic debug features');
        if (window.__msdDebug?.debug) {
          // Enable a basic set of debug features
          window.__msdDebug.debug.enable('anchors');
          window.__msdDebug.debug.enable('bounding_boxes');

          // Show user feedback
          const feedback = document.createElement('div');
          feedback.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 255, 0, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000001;
            pointer-events: none;
          `;
          feedback.textContent = 'Debug features enabled: anchors, bounding_boxes';
          document.body.appendChild(feedback);

          setTimeout(() => feedback.remove(), 3000);
        }
        break;
    }

    // ADDED: Selection heuristics
    if (this.bus) {
      if (action === 'overlay' && overlay) {
        this.bus.emit('select:set', { type: 'overlay', id: overlay, source: 'issues' });
      } else if (action === 'routing' && id) {
        this.bus.emit('select:set', { type: 'route', id, source: 'issues' });
      } else if (action === 'performance' && id) {
        this.bus.emit('select:set', { type: 'timer', id, source: 'issues' });
      }
    }
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
      // FIXED: Use centralized silent debug status access
      const debugStatus = window.__msdDebug?.getDebugStatusSilent?.() || {};
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
      // FIXED: Better debug feature status detection
      if (!debugStatus.initialized) {
        // Actually not initialized
        issues.debug.push({
          id: 'debug-status',
          type: 'debug',
          severity: 'warning',
          message: 'Debug interface not initialized',
          code: 'debug_not_initialized',
          clickAction: 'debug'
        });
      } else if (!debugStatus.enabled) {
        // Initialized but no features enabled - this is not really an "issue"
        // We could either skip this entirely or show an info message
        issues.debug.push({
          id: 'debug-features-disabled',
          type: 'debug',
          severity: 'info',
          message: 'All debug features are disabled',
          code: 'debug_features_off',
          clickAction: 'enable-features'
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
          data-bus-event="issues:action"
          data-action="${issue.clickAction}"
          data-id="${issue.id}"
          data-overlay="${issue.overlay || ''}"
          data-select-type="${issue.clickAction === 'overlay' ? 'overlay' : issue.clickAction === 'routing' ? 'route' : issue.clickAction === 'performance' ? 'timer' : 'issue'}"
          data-select-id="${issue.overlay || issue.id}"
          onclick="__msdHudBus('issues:action',{action:'${issue.clickAction}',id:'${issue.id}',overlay:'${issue.overlay || ''}'});__msdHudBus('select:set',{type:'${issue.clickAction === 'overlay' ? 'overlay' : issue.clickAction === 'routing' ? 'route' : issue.clickAction === 'performance' ? 'timer' : 'issue'}',id:'${issue.overlay || issue.id}',source:'issues'})"
          style="cursor:pointer; border-left:3px solid ${severityColor}; padding-left:6px; margin:2px 0;">
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

    html += '</div>';
    return html;
  }
}
