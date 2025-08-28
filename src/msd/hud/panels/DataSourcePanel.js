/**
 * Data source monitoring panel for MSD HUD
 * Displays DataSourceManager stats and entity data via consolidated interface
 */

export class DataSourcePanel {
  captureData() {
    const entities = {};
    const stats = {};

    try {
      // Use consolidated interface - single source of truth
      const pipelineInstance = window.__msdDebug?.pipelineInstance;
      const dsManager = pipelineInstance?.dataSourceManager ||
                       pipelineInstance?.systemsManager?.dataSourceManager ||
                       window.__msdDebug?.dataSourceManager;

      if (dsManager) {
        // Get entity list and stats from DataSourceManager
        const entityIds = dsManager.listIds?.() || [];
        const dsStats = dsManager.getStats?.() || {};

        // Transform DataSourceManager stats to panel format
        stats.count = entityIds.length;
        stats.subscribed = Object.keys(dsStats.sources || {}).length;
        stats.updated = Object.values(dsStats.sources || {}).reduce((sum, source) => sum + (source.received || 0), 0);
        stats.cacheHits = Object.values(dsStats.sources || {}).reduce((sum, source) => sum + (source.cacheHits || 0), 0);
        stats.errors = Object.values(dsStats.sources || {}).reduce((sum, source) => sum + (source.errors || 0), 0);

        // Sample recent entities (limit to prevent HUD overflow)
        entityIds.slice(0, 10).forEach(id => {
          const entity = dsManager.getEntity?.(id);
          if (entity) {
            entities[id] = {
              state: entity.state,
              lastChanged: entity.last_changed,
              lastUpdated: entity.last_updated,
              attributes: entity.attributes || {}
            };
          }
        });

        // Add data source specific info if available
        if (dsStats.sources) {
          stats.dataSources = Object.keys(dsStats.sources);
          stats.activeSubscriptions = Object.values(dsStats.sources).filter(source => source.subscribers > 0).length;
        }
      } else {
        console.warn('[DataSourcePanel] DataSourceManager not available via consolidated interface');
        stats.error = 'DataSourceManager not available';
      }
    } catch (e) {
      console.warn('[DataSourcePanel] Data capture failed:', e);
      stats.error = e.message;
    }

    return { entities, stats };
  }

  renderHtml(entityData) {
    let html = '<div class="msd-hud-panel"><h3>Data Sources</h3>';

    // Error handling
    const stats = entityData.stats || {};
    if (stats.error) {
      html += `<div class="msd-hud-section msd-hud-error">
        <h4>Error</h4>
        <div class="msd-hud-metric-value">${stats.error}</div>
      </div>`;
      html += '</div>';
      return html;
    }

    // Stats section - updated for DataSourceManager
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
      <span class="msd-hud-metric-name">Active Subs</span>
      <span class="msd-hud-metric-value">${stats.activeSubscriptions || 0}</span>
    </div>`;
    html += `<div class="msd-hud-metric">
      <span class="msd-hud-metric-name">Updates</span>
      <span class="msd-hud-metric-value">${stats.updated || 0}</span>
    </div>`;
    if (stats.cacheHits !== undefined) {
      html += `<div class="msd-hud-metric">
        <span class="msd-hud-metric-name">Cache Hits</span>
        <span class="msd-hud-metric-value">${stats.cacheHits}</span>
      </div>`;
    }
    if (stats.errors !== undefined && stats.errors > 0) {
      html += `<div class="msd-hud-metric msd-hud-warning">
        <span class="msd-hud-metric-name">Errors</span>
        <span class="msd-hud-metric-value">${stats.errors}</span>
      </div>`;
    }
    html += '</div>';

    // Data sources section
    if (stats.dataSources && stats.dataSources.length > 0) {
      html += '<div class="msd-hud-section"><h4>Active Sources</h4>';
      stats.dataSources.slice(0, 6).forEach(sourceName => {
        const shortName = sourceName.length > 20 ? sourceName.substring(0, 17) + '...' : sourceName;
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">${shortName}</span>
          <span class="msd-hud-metric-value">●</span>
        </div>`;
      });
      html += '</div>';
    }

    // Recent entities section
    const entities = Object.entries(entityData.entities || {}).slice(0, 6);
    if (entities.length > 0) {
      html += '<div class="msd-hud-section"><h4>Recent Updates</h4>';
      entities.forEach(([id, entity]) => {
        const shortId = id.length > 20 ? id.substring(0, 17) + '...' : id;
        const stateValue = entity.state || 'N/A';
        const shortState = stateValue.length > 10 ? stateValue.substring(0, 7) + '...' : stateValue;
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">${shortId}</span>
          <span class="msd-hud-metric-value">${shortState}</span>
        </div>`;
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
