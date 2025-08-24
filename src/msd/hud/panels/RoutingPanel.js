/**
 * Routing inspection panel for MSD HUD
 * Shows connector routing data with cost display and success indicators
 */

export class RoutingPanel {
  captureData(resolvedModel) {
    const routes = [];

    try {
      const lineOverlays = resolvedModel?.overlays?.filter(o => o.type === 'line') || [];

      // FIXED: Handle both browser and Node.js global window access
      const window = (typeof global !== 'undefined' && global.window) ? global.window :
                    (typeof window !== 'undefined') ? window : null;

      // Limit to 10 routes to prevent UI bloat
      for (const overlay of lineOverlays.slice(0, 10)) {
        const routeInfo = window?.__msdDebug?.routing?.inspect?.(overlay.id);
        if (routeInfo) {
          routes.push({
            id: overlay.id,
            strategy: routeInfo.meta?.strategy || 'unknown',
            cost: routeInfo.meta?.cost || 0,
            success: routeInfo.meta?.success !== false
          });
        }
      }
    } catch (_) {}

    return { routes, count: routes.length };
  }

  renderHtml(routing) {
    let html = '<div class="msd-hud-panel"><h3>Routing</h3>';

    const routes = routing.routes || [];

    if (routes.length === 0) {
      html += '<div class="msd-hud-section">No routes found</div>';
    } else {
      html += `<div class="msd-hud-section"><h4>${routing.count || routes.length} routes</h4>`;

      // Show first 8 routes to prevent UI bloat
      const displayRoutes = routes.slice(0, 8);

      displayRoutes.forEach(route => {
        const statusClass = route.success ? 'msd-hud-success' : 'msd-hud-failed';
        const statusText = route.success ? 'success' : 'failed';

        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">${route.id}</span>
          <span class="msd-hud-metric-value">
            ${route.strategy} ${route.cost.toFixed(1)}
            <span class="${statusClass}">${statusText}</span>
          </span>
        </div>`;
      });

      if (routes.length > 8) {
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">...</span>
          <span class="msd-hud-metric-value">+${routes.length - 8} more</span>
        </div>`;
      }

      html += '</div>';
    }

    html += '</div>';
    return html;
  }
}
