import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';
/**
 * [ChannelTrendPanel] Advanced channel trend panel for MSD HUD
 * 📈 Historical channel usage analysis with conflict detection
 */

export class ChannelTrendPanel {
  constructor() {
    this.history = new Map(); // channelId -> array of usage counts
    this.maxHistoryLength = 30;
    this.conflictThreshold = 3; // channels with >3 simultaneous routes
    this.lastSnapshot = null;
  }

  captureData() {
    const routing = window.__msdDebug?.routing;
    const current = routing?.channels?._occupancy || {};
    const conflicts = [];
    const trends = {};
    const recommendations = [];

    try {
      // Update history
      Object.entries(current).forEach(([channelId, count]) => {
        if (!this.history.has(channelId)) {
          this.history.set(channelId, []);
        }

        const channelHistory = this.history.get(channelId);
        channelHistory.push(count);

        // Trim history
        if (channelHistory.length > this.maxHistoryLength) {
          channelHistory.shift();
        }
      });

      // Detect conflicts (channels with high usage)
      Object.entries(current).forEach(([channelId, count]) => {
        if (count >= this.conflictThreshold) {
          conflicts.push({
            channel: channelId,
            count: count,
            severity: count >= 5 ? 'high' : 'medium'
          });
        }
      });

      // Calculate trends
      this.history.forEach((history, channelId) => {
        if (history.length >= 3) {
          const recent = history.slice(-3);
          const avg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
          const trend = recent[recent.length - 1] - recent[0];

          trends[channelId] = {
            current: recent[recent.length - 1],
            average: avg,
            trend: trend, // positive = increasing usage
            variance: this.calculateVariance(recent),
            history: [...history] // copy for rendering
          };
        }
      });

      // Generate optimization recommendations
      if (conflicts.length > 0) {
        recommendations.push({
          type: 'conflict',
          message: `${conflicts.length} channel conflicts detected`,
          action: 'Consider adjusting routing strategy'
        });
      }

      const highVarianceChannels = Object.entries(trends)
        .filter(([_, data]) => data.variance > 2)
        .length;

      if (highVarianceChannels > 0) {
        recommendations.push({
          type: 'variance',
          message: `${highVarianceChannels} channels show high variance`,
          action: 'Review routing stability'
        });
      }

      // Check for unused optimization
      const totalChannels = this.history.size;
      const activeChannels = Object.keys(current).length;
      const unusedChannels = totalChannels - activeChannels;

      if (unusedChannels > 5) {
        recommendations.push({
          type: 'optimization',
          message: `${unusedChannels} channels currently unused`,
          action: 'Potential for route optimization'
        });
      }

    } catch (e) {
      cblcarsLog.warn('[ChannelTrendPanel] ⚠️ Data capture failed:', e);
    }

    return { current, conflicts, trends, recommendations };
  }

  calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  renderSparkline(history, maxValue = null) {
    if (!history || history.length === 0) return '';

    const max = maxValue || Math.max(...history, 1);
    const width = 40;
    const chars = ' ▁▂▃▄▅▆▇█';

    let sparkline = '';
    const step = Math.max(1, Math.floor(history.length / width));

    for (let i = 0; i < history.length; i += step) {
      const value = history[i];
      const ratio = value / max;
      const level = Math.min(chars.length - 1, Math.floor(ratio * (chars.length - 1)));
      sparkline += chars[level];
    }

    return sparkline;
  }

  renderHtml(channelData) {
    let html = '<div class="msd-hud-panel"><h3>Channel Trends</h3>';

    const { current, conflicts, trends, recommendations } = channelData;

    // Conflicts section
    if (conflicts && conflicts.length > 0) {
      html += '<div class="msd-hud-section msd-hud-warning"><h4>Conflicts Detected</h4>';
      conflicts.forEach(conflict => {
        const severityColor = conflict.severity === 'high' ? '#ff4444' : '#ffaa00';
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name" style="color:${severityColor};">${conflict.channel}</span>
          <span class="msd-hud-metric-value">${conflict.count} routes</span>
        </div>`;
      });
      html += '</div>';
    }

    // Recommendations section
    if (recommendations && recommendations.length > 0) {
      html += '<div class="msd-hud-section"><h4>Recommendations</h4>';
      recommendations.forEach(rec => {
        const typeColor = rec.type === 'conflict' ? '#ff6666' :
                         rec.type === 'variance' ? '#ffaa00' : '#66ff99';
        html += `<div class="msd-hud-metric">
          <div style="color:${typeColor};font-size:10px;">${rec.message}</div>
          <div style="color:#888;font-size:9px;">${rec.action}</div>
        </div>`;
      });
      html += '</div>';
    }

    // Trends section with sparklines
    if (trends && Object.keys(trends).length > 0) {
      html += '<div class="msd-hud-section"><h4>Usage Trends</h4>';

      // Sort by current usage
      const sortedTrends = Object.entries(trends)
        .sort(([,a], [,b]) => b.current - a.current)
        .slice(0, 8);

      sortedTrends.forEach(([channelId, data]) => {
        const shortId = channelId.length > 15 ? channelId.substring(0, 12) + '...' : channelId;
        const trendIndicator = data.trend > 0 ? '↗' : data.trend < 0 ? '↘' : '→';
        const trendColor = data.trend > 0 ? '#ff6666' : data.trend < 0 ? '#66ff99' : '#888';
        const sparkline = this.renderSparkline(data.history);

        html += `<div class="msd-hud-metric" style="margin:4px 0;">
          <div style="display:flex;justify-content:space-between;">
            <span class="msd-hud-metric-name">${shortId}</span>
            <span class="msd-hud-metric-value">${data.current}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;margin-top:2px;">
            <span style="font-family:monospace;color:#888;">${sparkline}</span>
            <span style="color:${trendColor};">${trendIndicator} ${data.average.toFixed(1)}</span>
          </div>
        </div>`;
      });

      html += '</div>';
    }

    // Current status summary
    const currentCount = Object.keys(current || {}).length;
    const totalUsage = Object.values(current || {}).reduce((sum, count) => sum + count, 0);
    const historySize = this.history.size;

    html += `<div class="msd-hud-section msd-hud-summary">
      ${currentCount} active channels • ${totalUsage} total routes • ${historySize} tracked
    </div>`;

    html += '</div>';
    return html;
  }
}
