import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';
/**
 * [RulesPanel] Rules panel for MSD HUD
 * 📏 Shows rules engine evaluation trace and rule activity
 */

export class RulesPanel {
  captureData() {
    const rules = [];
    const trace = [];
    const stats = {};

    try {
      const pipelineInstance = window.__msdDebug?.pipelineInstance;
      const rulesEngine = pipelineInstance?.systemsManager?.rulesEngine ||
                         pipelineInstance?.rulesEngine;

      if (rulesEngine) {
        cblcarsLog.debug('[RulesPanel] 📋 Capturing rules engine data');
        // Get trace information - FIXED: Handle non-array trace
        const engineTrace = rulesEngine.getTrace?.() || [];
        if (Array.isArray(engineTrace)) {
          trace.push(...engineTrace);
          cblcarsLog.debug(`[RulesPanel] 🔍 Captured ${engineTrace.length} trace entries`);
        } else if (engineTrace) {
          // Handle case where trace might be a single object or other format
          trace.push(engineTrace);
          cblcarsLog.debug('[RulesPanel] 🔍 Captured single trace entry (non-array format)');
        } else {
          cblcarsLog.debug('[RulesPanel] 🚫 No trace data available from rules engine');
        }

        // Get rules list - FIXED: Handle non-array rules
        const rulesList = rulesEngine.rules || rulesEngine._rules || [];
        if (Array.isArray(rulesList)) {
          cblcarsLog.debug(`[RulesPanel] 📜 Processing ${rulesList.length} rules from engine`);
          rulesList.forEach(rule => {
            const traceInfo = trace.find(t => t && t.id === rule.id);
            rules.push({
              id: rule.id,
              priority: rule.priority || 0,
              lastMatch: traceInfo?.matched || false,
              matchCount: rule._matchCount || rule.matchCount || 0,
              conditions: rule.when ? Object.keys(rule.when).length : 0,
              actions: rule.apply ? Object.keys(rule.apply).length : 0
            });
          });
        } else {
          cblcarsLog.warn('[RulesPanel] ⚠️ Rules list is not an array or is empty');
        }

        // Calculate stats
        stats.totalRules = rules.length;
        stats.matchedRules = rules.filter(r => r.lastMatch).length;
        stats.totalMatches = rules.reduce((sum, r) => sum + r.matchCount, 0);
        stats.avgPriority = rules.length > 0 ?
          rules.reduce((sum, r) => sum + r.priority, 0) / rules.length : 0;

        cblcarsLog.debug(`[RulesPanel] 📊 Captured ${stats.totalRules} rules, ${stats.matchedRules} currently matched, ${stats.totalMatches} total matches`);
      } else {
        cblcarsLog.warn('[RulesPanel] ⚠️ Rules engine not available for data capture');
      }
    } catch (e) {
      cblcarsLog.warn('[RulesPanel] ⚠️ Data capture failed:', e);
      // ADDED: Provide fallback data structure to prevent rendering errors
      return {
        rules: [],
        trace: [],
        stats: {
          totalRules: 0,
          matchedRules: 0,
          totalMatches: 0,
          avgPriority: 0
        }
      };
    }

    return { rules, trace, stats };
  }

  /**
   * Clean up panel resources
   */
  destroy() {
    // No specific resources to clean up for this panel
    cblcarsLog.debug(`[MSD:${this.constructor.name}] Panel cleanup completed`);
  }

  renderHtml(rulesData) {
    let html = '<div class="msd-hud-panel"><h3>Rules Engine</h3>';

    const { rules, trace, stats } = rulesData;

    // Stats section
    if (stats && Object.keys(stats).length > 0) {
      html += '<div class="msd-hud-section"><h4>Statistics</h4>';
      html += `<div class="msd-hud-metric">
        <span class="msd-hud-metric-name">Total Rules</span>
        <span class="msd-hud-metric-value">${stats.totalRules}</span>
      </div>`;
      html += `<div class="msd-hud-metric">
        <span class="msd-hud-metric-name">Currently Matched</span>
        <span class="msd-hud-metric-value" style="color:${stats.matchedRules > 0 ? '#66ff99' : '#666'};">
          ${stats.matchedRules}
        </span>
      </div>`;
      html += `<div class="msd-hud-metric">
        <span class="msd-hud-metric-name">Total Matches</span>
        <span class="msd-hud-metric-value">${stats.totalMatches}</span>
      </div>`;
      html += `<div class="msd-hud-metric">
        <span class="msd-hud-metric-name">Avg Priority</span>
        <span class="msd-hud-metric-value">${stats.avgPriority.toFixed(1)}</span>
      </div>`;
      html += '</div>';
    }

    // Rules list section
    if (rules && rules.length > 0) {
      html += '<div class="msd-hud-section"><h4>Rules Activity</h4>';

      // Sort by priority descending, then by match status
      const sortedRules = [...rules].sort((a, b) => {
        if (a.lastMatch !== b.lastMatch) return b.lastMatch - a.lastMatch; // matched first
        return b.priority - a.priority; // then by priority
      });

      sortedRules.slice(0, 10).forEach(rule => {
        const shortId = rule.id.length > 20 ? rule.id.substring(0, 17) + '...' : rule.id;
        const matchStatus = rule.lastMatch ? '✓' : '○';
        const matchColor = rule.lastMatch ? '#66ff99' : '#666';

        html += `<div class="msd-hud-metric"
          data-select-type="rule"
          data-select-id="${rule.id}"
          onclick="__msdHudBus('select:set',{type:'rule',id:'${rule.id}',source:'rules'})"
          style="margin:2px 0;padding:2px;${rule.lastMatch ? 'background:rgba(102,255,153,0.1);' : ''} border-radius:3px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="msd-hud-metric-name">${shortId}</span>
            <div style="display:flex;gap:8px;align-items:center;">
              <span style="font-size:10px;color:#888;">p:${rule.priority}</span>
              <span style="color:${matchColor};font-weight:bold;">${matchStatus}</span>
            </div>
          </div>
          <div style="font-size:10px;color:#888;margin-top:1px;">
            ${rule.conditions} conditions • ${rule.actions} actions • ${rule.matchCount} matches
          </div>
        </div>`;
      });

      if (sortedRules.length > 10) {
        html += `<div style="font-size:10px;text-align:center;color:#666;margin-top:4px;">
          ... ${sortedRules.length - 10} more rules
        </div>`;
      }

      html += '</div>';
    } else {
      html += '<div class="msd-hud-section">No rules engine data available</div>';
    }

    html += '</div>';
    return html;
  }
}
