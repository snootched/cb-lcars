/**
 * Routing diagnostics panel for MSD HUD
 * Displays routing statistics and path computation data
 */

export class RoutingPanel {
  captureData() {
    const stats = {};
    const routes = {};

    try {
      const routing = window.__msdDebug?.routing;
      if (routing) {
        // Get routing statistics
        const routingStats = routing.stats?.() || {};
        Object.assign(stats, routingStats);

        // Get sample route inspections (for line overlays)
        const pipeline = window.__msdDebug?.pipelineInstance;
        if (pipeline) {
          const model = pipeline.getResolvedModel?.();
          if (model?.overlays) {
            const lineOverlays = model.overlays
              .filter(o => o.type === 'line' && o.anchor && o.attach_to)
              .slice(0, 5);

            lineOverlays.forEach(overlay => {
              try {
                const routeInfo = routing.inspect?.(overlay.id);
                if (routeInfo && routeInfo.pts) {
                  // FIXED: Use the correct data structure from routing inspection
                  routes[overlay.id] = {
                    mode: routeInfo.meta?.strategy || 'auto',
                    pathLength: routeInfo.pts?.length || 0,
                    segments: routeInfo.meta?.segments || 0,
                    bends: routeInfo.meta?.bends || 0,
                    cost: routeInfo.meta?.cost || 0,
                    cached: routeInfo.meta?.cache_hit || false,
                    success: routeInfo.pts && routeInfo.pts.length > 0,
                    arcCount: routeInfo.meta?.arc?.count || 0
                  };
                } else {
                  // Fallback for missing route info
                  routes[overlay.id] = {
                    mode: 'unknown',
                    pathLength: 0,
                    segments: 0,
                    bends: 0,
                    cost: 0,
                    cached: false,
                    success: false,
                    arcCount: 0
                  };
                }
              } catch (e) {
                console.warn(`[RoutingPanel] Route inspection failed for ${overlay.id}:`, e);
              }
            });
          }
        }
      }
    } catch (e) {
      console.warn('[RoutingPanel] Data capture failed:', e);
    }

    return { stats, routes };
  }

  renderHtml(routingData) {
    let html = '<div class="msd-hud-panel"><h3>Routing</h3>';

    // Statistics section
    const stats = routingData.stats || {};
    if (Object.keys(stats).length > 0) {
      html += '<div class="msd-hud-section"><h4>Cache Statistics</h4>';

      if (stats.size !== undefined) {
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">Cache Size</span>
          <span class="msd-hud-metric-value">${stats.size}</span>
        </div>`;
      }

      if (stats.max !== undefined) {
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">Cache Max</span>
          <span class="msd-hud-metric-value">${stats.max}</span>
        </div>`;
      }

      if (stats.rev !== undefined) {
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">Cache Rev</span>
          <span class="msd-hud-metric-value">${stats.rev}</span>
        </div>`;
      }

      if (stats.obstacles !== undefined) {
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">Obstacles</span>
          <span class="msd-hud-metric-value">${stats.obstacles}</span>
        </div>`;
      }

      html += '</div>';
    }

    // Routes section - ENHANCED with rich data
    const routes = Object.entries(routingData.routes || {});
    if (routes.length > 0) {
      html += '<div class="msd-hud-section"><h4>Active Routes</h4>';
      routes.forEach(([id, route]) => {
        const shortId = id.length > 15 ? id.substring(0, 12) + '...' : id;
        const statusClass = route.success ? 'msd-hud-success' : 'msd-hud-error';

        // ENHANCED: Show strategy and path points
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">${shortId}</span>
          <span class="msd-hud-metric-value ${statusClass}">${route.mode} (${route.pathLength} pts)</span>
        </div>`;

        // ENHANCED: Show routing details
        if (route.success) {
          html += `<div class="msd-hud-metric-detail">
            ${route.segments} seg, ${route.bends} bend, cost:${route.cost}
          </div>`;

          if (route.arcCount > 0) {
            html += `<div class="msd-hud-metric-detail">🔄 ${route.arcCount} arc corners</div>`;
          }

          if (route.cached) {
            html += '<div class="msd-hud-metric-detail">📋 Cached</div>';
          }
        }
      });
      html += '</div>';
    } else {
      html += '<div class="msd-hud-section">No active routes found</div>';
    }

    html += '</div>';
    return html;
  }
}
