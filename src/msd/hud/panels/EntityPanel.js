/**
 * Entity monitoring panel for MSD HUD
 * Displays entity data and subscription status
 */

export class EntityPanel {
  captureData() {
    const entities = {};
    const stats = {};

    try {
      const entityRuntime = window.__msdDebug?.entities;
      if (entityRuntime) {
        // Get entity list and stats
        const entityIds = entityRuntime.list?.() || [];
        const runtimeStats = entityRuntime.stats?.() || {};

        // Copy all stats
        Object.assign(stats, runtimeStats);
        stats.count = entityIds.length;

        // Sample recent entities (limit to prevent HUD overflow)
        entityIds.slice(0, 10).forEach(id => {
          const entity = entityRuntime.get?.(id);
          if (entity) {
            entities[id] = {
              state: entity.state,
              lastChanged: entity.last_changed,
              lastUpdated: entity.last_updated,
              attributes: entity.attributes || {}
            };
          }
        });
      }
    } catch (e) {
      console.warn('[EntityPanel] Data capture failed:', e);
    }

    return { entities, stats };
  }

  renderHtml(entityData) {
    let html = '<div class="msd-hud-panel"><h3>Entities</h3>';

    // Stats section
    const stats = entityData.stats || {};
    html += '<div class="msd-hud-section"><h4>Statistics</h4>';
    html += `<div class="msd-hud-metric">
      <span class="msd-hud-metric-name">Total</span>
      <span class="msd-hud-metric-value">${stats.count || 0}</span>
    </div>`;
    html += `<div class="msd-hud-metric">
      <span class="msd-hud-metric-name">Subscribed</span>
      <span class="msd-hud-metric-value">${stats.subscribed || 0}</span>
    </div>`;
    html += `<div class="msd-hud-metric">
      <span class="msd-hud-metric-name">Updated</span>
      <span class="msd-hud-metric-value">${stats.updated || 0}</span>
    </div>`;
    if (stats.cacheHits !== undefined) {
      html += `<div class="msd-hud-metric">
        <span class="msd-hud-metric-name">Cache Hits</span>
        <span class="msd-hud-metric-value">${stats.cacheHits}</span>
      </div>`;
    }
    html += '</div>';

    // Recent entities section
    const entities = Object.entries(entityData.entities || {}).slice(0, 6);
    if (entities.length > 0) {
      html += '<div class="msd-hud-section"><h4>Recent Updates</h4>';
      entities.forEach(([id, entity]) => {
        const shortId = id.length > 20 ? id.substring(0, 17) + '...' : id;
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">${shortId}</span>
          <span class="msd-hud-metric-value">${entity.state || 'N/A'}</span>
        </div>`;
      });
      html += '</div>';
    } else {
      html += '<div class="msd-hud-section">No entity data available</div>';
    }

    html += '</div>';
    return html;
  }
}

