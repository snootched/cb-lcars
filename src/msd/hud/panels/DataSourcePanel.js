/**
 * Enhanced Data source monitoring panel for MSD HUD
 * DataSourceManager integration health checks and subscription diagnostics
 */

export class DataSourcePanel {
  constructor() {
    this.entityChangeHistory = new Map(); // entityId -> recent state changes
    this.maxHistoryLength = 10;
    this.setupGlobalHandlers();
  }

  setupGlobalHandlers() {
    if (window.__msdDataSourcePanel) return;

    const self = this;
    window.__msdDataSourcePanel = {
      inspectEntity: function(entityId) {
        try {
          const pipelineInstance = window.__msdDebug?.pipelineInstance;
          const dsManager = pipelineInstance?.dataSourceManager ||
                           pipelineInstance?.systemsManager?.dataSourceManager ||
                           window.__msdDebug?.dataSourceManager;

          if (dsManager?.getEntity) {
            const entity = dsManager.getEntity(entityId);
            console.log(`[DataSourcePanel] Entity ${entityId}:`, entity);
            console.table([entity]);
          } else {
            console.warn('[DataSourcePanel] DataSourceManager not available');
          }
        } catch (e) {
          console.warn('[DataSourcePanel] Entity inspection failed:', e);
        }
      },

      refreshSubscriptions: function() {
        try {
          const pipelineInstance = window.__msdDebug?.pipelineInstance;
          const dsManager = pipelineInstance?.dataSourceManager ||
                           pipelineInstance?.systemsManager?.dataSourceManager ||
                           window.__msdDebug?.dataSourceManager;

          if (dsManager?.refreshSubscriptions) {
            dsManager.refreshSubscriptions();
            console.log('[DataSourcePanel] Subscriptions refreshed');
          } else {
            console.warn('[DataSourcePanel] Refresh not available');
          }

          // Trigger HUD refresh
          if (window.__msdDebug?.hud?.refresh) {
            window.__msdDebug.hud.refresh();
          }
        } catch (e) {
          console.warn('[DataSourcePanel] Subscription refresh failed:', e);
        }
      },

      clearHistory: function() {
        self.entityChangeHistory.clear();
        console.log('[DataSourcePanel] Change history cleared');

        // Trigger refresh
        if (window.__msdDebug?.hud?.refresh) {
          window.__msdDebug.hud.refresh();
        }
      }
    };
  }

  captureData() {
    const entities = {};
    const stats = {};
    const health = {};
    const subscriptions = {};
    const recentChanges = [];

    try {
      const pipelineInstance = window.__msdDebug?.pipelineInstance;
      const dsManager = pipelineInstance?.dataSourceManager ||
                       pipelineInstance?.systemsManager?.dataSourceManager ||
                       window.__msdDebug?.dataSourceManager;

      if (dsManager) {
        // Get comprehensive stats
        const entityIds = dsManager.listIds?.() || [];
        const dsStats = dsManager.getStats?.() || {};
        const healthCheck = dsManager.getHealth?.() || {};

        // Transform stats
        stats.count = entityIds.length;
        stats.subscribed = Object.keys(dsStats.sources || {}).length;
        stats.updated = Object.values(dsStats.sources || {}).reduce((sum, source) => sum + (source.received || 0), 0);
        stats.cacheHits = Object.values(dsStats.sources || {}).reduce((sum, source) => sum + (source.cacheHits || 0), 0);
        stats.errors = Object.values(dsStats.sources || {}).reduce((sum, source) => sum + (source.errors || 0), 0);

        // Health metrics
        if (healthCheck.status) {
          health.status = healthCheck.status;
          health.uptime = healthCheck.uptime || 0;
          health.lastError = healthCheck.lastError;
          health.connectionCount = healthCheck.connectionCount || 0;
        }

        // Subscription details
        if (dsStats.sources) {
          Object.entries(dsStats.sources).forEach(([sourceName, sourceData]) => {
            subscriptions[sourceName] = {
              subscribers: sourceData.subscribers || 0,
              received: sourceData.received || 0,
              errors: sourceData.errors || 0,
              lastUpdate: sourceData.lastUpdate,
              cacheHits: sourceData.cacheHits || 0
            };
          });
        }

        // Sample recent entities and track changes
        entityIds.slice(0, 15).forEach(id => {
          const entity = dsManager.getEntity?.(id);
          if (entity) {
            // Track state changes
            const previousState = this.entityChangeHistory.get(id);
            if (previousState && previousState.state !== entity.state) {
              recentChanges.push({
                id: id,
                from: previousState.state,
                to: entity.state,
                timestamp: Date.now()
              });
            }

            // Store current state
            this.entityChangeHistory.set(id, {
              state: entity.state,
              timestamp: Date.now()
            });

            // Trim history
            if (this.entityChangeHistory.size > this.maxHistoryLength) {
              const oldestKey = this.entityChangeHistory.keys().next().value;
              this.entityChangeHistory.delete(oldestKey);
            }

            entities[id] = {
              state: entity.state,
              lastChanged: entity.last_changed,
              lastUpdated: entity.last_updated,
              attributes: entity.attributes || {},
              domain: id.split('.')[0] // Extract domain for grouping
            };
          }
        });

      } else {
        console.warn('[DataSourcePanel] DataSourceManager not available via consolidated interface');
        stats.error = 'DataSourceManager not available';
      }
    } catch (e) {
      console.warn('[DataSourcePanel] Data capture failed:', e);
      stats.error = e.message;
    }

    return { entities, stats, health, subscriptions, recentChanges };
  }

  renderHtml(entityData) {
    let html = '<div class="msd-hud-panel"><h3>Data Sources</h3>';

    const { entities, stats, health, subscriptions, recentChanges } = entityData;

    // Error handling
    if (stats.error) {
      html += `<div class="msd-hud-section msd-hud-error">
        <h4>Error</h4>
        <div class="msd-hud-metric-value">${stats.error}</div>
      </div>`;
      html += '</div>';
      return html;
    }

    // Controls section
    html += '<div class="msd-hud-section"><h4>Controls</h4>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';

    html += `<button onclick="window.__msdDataSourcePanel?.refreshSubscriptions()"
      style="font-size:10px;padding:2px 6px;background:#333;color:#fff;border:1px solid #555;border-radius:3px;cursor:pointer;">
      Refresh Subs
    </button>`;

    html += `<button onclick="window.__msdDataSourcePanel?.clearHistory()"
      style="font-size:10px;padding:2px 6px;background:#666;color:#fff;border:1px solid #888;border-radius:3px;cursor:pointer;">
      Clear History
    </button>`;

    html += '</div></div>';

    // Health section
    if (health && health.status) {
      const statusColor = health.status === 'healthy' ? '#66ff99' :
                         health.status === 'warning' ? '#ffaa00' : '#ff6666';

      html += '<div class="msd-hud-section"><h4>Health Status</h4>';
      html += `<div class="msd-hud-metric">
        <span class="msd-hud-metric-name">Status</span>
        <span class="msd-hud-metric-value" style="color:${statusColor};">${health.status}</span>
      </div>`;

      if (health.uptime > 0) {
        const uptimeHours = (health.uptime / (1000 * 60 * 60)).toFixed(1);
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">Uptime</span>
          <span class="msd-hud-metric-value">${uptimeHours}h</span>
        </div>`;
      }

      if (health.connectionCount !== undefined) {
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">Connections</span>
          <span class="msd-hud-metric-value">${health.connectionCount}</span>
        </div>`;
      }

      if (health.lastError) {
        html += `<div class="msd-hud-metric msd-hud-warning">
          <span class="msd-hud-metric-name">Last Error</span>
          <span class="msd-hud-metric-value">${health.lastError}</span>
        </div>`;
      }

      html += '</div>';
    }

    // Enhanced statistics section
    html += '<div class="msd-hud-section"><h4>Statistics</h4>';
    html += `<div class="msd-hud-metric">
      <span class="msd-hud-metric-name">Total Entities</span>
      <span class="msd-hud-metric-value">${stats.count || 0}</span>
    </div>`;
    html += `<div class="msd-hud-metric">
      <span class="msd-hud-metric-name">Data Sources</span>
      <span class="msd-hud-metric-value">${stats.subscribed || 0}</span>
    </div>`;
    html += `<div class="msd-hud-metric">
      <span class="msd-hud-metric-name">Total Updates</span>
      <span class="msd-hud-metric-value">${stats.updated || 0}</span>
    </div>`;
    if (stats.cacheHits !== undefined) {
      const hitRate = stats.updated > 0 ? ((stats.cacheHits / stats.updated) * 100).toFixed(1) : '0';
      html += `<div class="msd-hud-metric">
        <span class="msd-hud-metric-name">Cache Hit Rate</span>
        <span class="msd-hud-metric-value">${hitRate}%</span>
      </div>`;
    }
    if (stats.errors !== undefined && stats.errors > 0) {
      html += `<div class="msd-hud-metric msd-hud-warning">
        <span class="msd-hud-metric-name">Errors</span>
        <span class="msd-hud-metric-value">${stats.errors}</span>
      </div>`;
    }
    html += '</div>';

    // Subscription diagnostics
    if (subscriptions && Object.keys(subscriptions).length > 0) {
      html += '<div class="msd-hud-section"><h4>Active Subscriptions</h4>';
      Object.entries(subscriptions).slice(0, 6).forEach(([sourceName, sourceData]) => {
        const shortName = sourceName.length > 18 ? sourceName.substring(0, 15) + '...' : sourceName;
        const hasErrors = sourceData.errors > 0;
        const errorClass = hasErrors ? 'msd-hud-warning' : '';

        html += `<div class="msd-hud-metric ${errorClass}">
          <div style="display:flex;justify-content:space-between;">
            <span class="msd-hud-metric-name">${shortName}</span>
            <span class="msd-hud-metric-value">${sourceData.subscribers} subs</span>
          </div>
          <div style="font-size:10px;color:#888;margin-top:2px;">
            ${sourceData.received} updates • ${sourceData.cacheHits} cached
            ${hasErrors ? ` • ${sourceData.errors} errors` : ''}
          </div>
        </div>`;
      });
      html += '</div>';
    }

    // Recent state changes
    if (recentChanges && recentChanges.length > 0) {
      html += '<div class="msd-hud-section"><h4>Recent Changes</h4>';
      recentChanges.slice(-5).forEach(change => {
        const shortId = change.id.length > 20 ? change.id.substring(0, 17) + '...' : change.id;
        const timeAgo = Math.round((Date.now() - change.timestamp) / 1000);

        html += `<div class="msd-hud-metric" style="cursor:pointer;"
          onclick="window.__msdDataSourcePanel?.inspectEntity('${change.id}')">
          <div style="display:flex;justify-content:space-between;">
            <span class="msd-hud-metric-name">${shortId}</span>
            <span style="font-size:10px;color:#888;">${timeAgo}s ago</span>
          </div>
          <div style="font-size:10px;color:#ccc;margin-top:1px;">
            ${change.from} → ${change.to}
          </div>
        </div>`;
      });
      html += '</div>';
    }

    // Entity samples by domain
    const entities_entries = Object.entries(entities || {});
    if (entities_entries.length > 0) {
      // Group by domain
      const byDomain = {};
      entities_entries.forEach(([id, entity]) => {
        const domain = entity.domain || 'unknown';
        if (!byDomain[domain]) byDomain[domain] = [];
        byDomain[domain].push([id, entity]);
      });

      html += '<div class="msd-hud-section"><h4>Entity Samples</h4>';
      Object.entries(byDomain).slice(0, 4).forEach(([domain, domainEntities]) => {
        html += `<div style="margin-bottom:6px;">
          <div style="font-weight:bold;font-size:11px;color:#ffaa00;">${domain} (${domainEntities.length})</div>`;

        domainEntities.slice(0, 3).forEach(([id, entity]) => {
          const shortId = id.length > 20 ? id.substring(0, 17) + '...' : id;
          const stateValue = entity.state || 'N/A';
          const shortState = stateValue.length > 12 ? stateValue.substring(0, 9) + '...' : stateValue;

          html += `<div class="msd-hud-metric" style="cursor:pointer;margin-left:10px;"
            onclick="window.__msdDataSourcePanel?.inspectEntity('${id}')">
            <span class="msd-hud-metric-name">${shortId}</span>
            <span class="msd-hud-metric-value">${shortState}</span>
          </div>`;
        });

        html += '</div>';
      });
      html += '</div>';
    } else if (stats.count > 0) {
      html += '<div class="msd-hud-section">Entities available but no recent data</div>';
    } else {
      html += '<div class="msd-hud-section">No entity data available</div>';
    }

    html += '</div>';
    return html;
  }
}
