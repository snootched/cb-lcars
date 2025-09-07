/**
 * Enhanced Routing diagnostics panel for MSD HUD
 * Displays routing statistics and path computation data with filtering and analysis
 */

export class RoutingPanel {
  constructor() {
    this.filters = {
      strategy: 'all',
      minCost: 0,
      maxCost: 1000,
      cacheHit: 'all',
      showArcs: false
    };

    this.setupGlobalHandlers();
  }

  setupGlobalHandlers() {
    if (window.__msdRoutingPanel) return;

    const self = this;
    window.__msdRoutingPanel = {
      setFilter: function(key, value) {
        self.filters[key] = value;
        // Trigger refresh via HUD
        if (window.__msdDebug?.hud?.refresh) {
          window.__msdDebug.hud.refresh();
        }
      },

      highlightRoute: function(routeId) {
        console.log('[RoutingPanel] Highlighting route:', routeId);
        // Emit routing focus event for other panels
        if (window.__msdDebug?.hud?.emit) {
          window.__msdDebug.hud.emit('routing:focus', { id: routeId });
        }
      },

      analyzeRoute: function(routeId) {
        const routing = window.__msdDebug?.routing;
        if (routing?.inspect) {
          const analysis = routing.inspect(routeId);
          console.table(analysis);
          console.log('[RoutingPanel] Route analysis for', routeId, ':', analysis);
        }
      }
    };
  }

  captureData() {
    const stats = {};
    const routes = {};
    const performance = {};

    try {
      const routing = window.__msdDebug?.routing;
      if (routing) {
        // Get routing statistics
        const routingStats = routing.stats?.() || {};
        Object.assign(stats, routingStats);

        // Add performance metrics
        if (routing.getPerformanceMetrics) {
          performance.metrics = routing.getPerformanceMetrics();
        }

        // Get route inspections for line overlays
        const pipeline = window.__msdDebug?.pipelineInstance;
        if (pipeline) {
          const model = pipeline.getResolvedModel?.();
          if (model?.overlays) {
            const lineOverlays = model.overlays
              .filter(o => o.type === 'line' && o.anchor && o.attach_to)
              .slice(0, 15); // More routes for filtering

            lineOverlays.forEach(overlay => {
              try {
                const routeInfo = routing.inspect?.(overlay.id);
                if (routeInfo && routeInfo.pts) {
                  routes[overlay.id] = {
                    id: overlay.id,
                    strategy: routeInfo.meta?.strategy || 'auto',
                    pathLength: routeInfo.pts?.length || 0,
                    segments: routeInfo.meta?.segments || 0,
                    bends: routeInfo.meta?.bends || 0,
                    cost: routeInfo.meta?.cost || 0,
                    cached: routeInfo.meta?.cache_hit || false,
                    success: routeInfo.pts && routeInfo.pts.length > 0,
                    arcCount: routeInfo.meta?.arc?.count || 0,
                    // Enhanced data
                    startAnchor: overlay.anchor,
                    endAnchor: overlay.attach_to,
                    smooth: routeInfo.meta?.smooth || false,
                    channel: routeInfo.meta?.channel,
                    computeTime: routeInfo.meta?.compute_time_ms || 0
                  };
                } else {
                  routes[overlay.id] = {
                    id: overlay.id,
                    strategy: 'unknown',
                    pathLength: 0,
                    segments: 0,
                    bends: 0,
                    cost: 0,
                    cached: false,
                    success: false,
                    arcCount: 0,
                    startAnchor: overlay.anchor,
                    endAnchor: overlay.attach_to,
                    smooth: false,
                    channel: null,
                    computeTime: 0
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

    return { stats, routes, performance };
  }

  filterRoutes(routes) {
    return Object.values(routes).filter(route => {
      // Strategy filter
      if (this.filters.strategy !== 'all' && route.strategy !== this.filters.strategy) {
        return false;
      }

      // Cost range filter
      if (route.cost < this.filters.minCost || route.cost > this.filters.maxCost) {
        return false;
      }

      // Cache hit filter
      if (this.filters.cacheHit === 'hit' && !route.cached) return false;
      if (this.filters.cacheHit === 'miss' && route.cached) return false;

      // Arc filter
      if (this.filters.showArcs && route.arcCount === 0) return false;

      return true;
    });
  }

  renderHtml(routingData) {
    let html = '<div class="msd-hud-panel"><h3>Enhanced Routing</h3>';

    // Filters section
    html += '<div class="msd-hud-section"><h4>Filters</h4>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">';

    // Strategy filter
    const strategies = ['all', 'auto', 'manhattan', 'smooth', 'direct'];
    html += '<select onchange="window.__msdRoutingPanel?.setFilter(\'strategy\', this.value)" style="font-size:10px;">';
    strategies.forEach(strategy => {
      const selected = this.filters.strategy === strategy ? 'selected' : '';
      html += `<option value="${strategy}" ${selected}>${strategy}</option>`;
    });
    html += '</select>';

    // Cost range
    html += `<input type="number" placeholder="Min cost" value="${this.filters.minCost}"
      onchange="window.__msdRoutingPanel?.setFilter('minCost', parseFloat(this.value))"
      style="width:60px;font-size:10px;">`;
    html += `<input type="number" placeholder="Max cost" value="${this.filters.maxCost}"
      onchange="window.__msdRoutingPanel?.setFilter('maxCost', parseFloat(this.value))"
      style="width:60px;font-size:10px;">`;

    // Cache filter
    html += '<select onchange="window.__msdRoutingPanel?.setFilter(\'cacheHit\', this.value)" style="font-size:10px;">';
    ['all', 'hit', 'miss'].forEach(cache => {
      const selected = this.filters.cacheHit === cache ? 'selected' : '';
      html += `<option value="${cache}" ${selected}>Cache: ${cache}</option>`;
    });
    html += '</select>';

    html += '</div></div>';

    // Statistics section
    const stats = routingData.stats || {};
    if (Object.keys(stats).length > 0) {
      html += '<div class="msd-hud-section"><h4>Cache Statistics</h4>';

      Object.entries(stats).forEach(([key, value]) => {
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">${key}</span>
          <span class="msd-hud-metric-value">${value}</span>
        </div>`;
      });

      html += '</div>';
    }

    // Performance section
    const performance = routingData.performance || {};
    if (performance.metrics) {
      html += '<div class="msd-hud-section"><h4>Performance</h4>';

      Object.entries(performance.metrics).forEach(([key, value]) => {
        const displayValue = typeof value === 'number' ? value.toFixed(2) : value;
        html += `<div class="msd-hud-metric">
          <span class="msd-hud-metric-name">${key}</span>
          <span class="msd-hud-metric-value">${displayValue}</span>
        </div>`;
      });

      html += '</div>';
    }

    // Filtered routes section
    const allRoutes = routingData.routes || {};
    const filteredRoutes = this.filterRoutes(allRoutes);

    if (filteredRoutes.length > 0) {
      html += `<div class="msd-hud-section"><h4>Routes (${filteredRoutes.length}/${Object.keys(allRoutes).length})</h4>`;

      // Sort by cost descending
      filteredRoutes.sort((a, b) => b.cost - a.cost);

      filteredRoutes.slice(0, 8).forEach(route => {
        const shortId = route.id.length > 15 ? route.id.substring(0, 12) + '...' : route.id;
        const statusClass = route.success ? 'msd-hud-success' : 'msd-hud-error';
        const costColor = route.cost > 50 ? '#ff6666' : route.cost > 20 ? '#ffaa00' : '#66ff99';

        html += `<div class="msd-hud-metric" style="cursor:pointer;border:1px solid #333;padding:4px;margin:2px 0;border-radius:3px;"
          onclick="window.__msdRoutingPanel?.highlightRoute('${route.id}')">
          <div style="display:flex;justify-content:space-between;">
            <span class="msd-hud-metric-name">${shortId}</span>
            <span class="msd-hud-metric-value" style="color:${costColor};">${route.cost.toFixed(1)}</span>
          </div>
          <div style="font-size:10px;color:#888;margin-top:2px;">
            ${route.strategy} • ${route.pathLength}pts • ${route.bends}↻
            ${route.cached ? ' • 📋' : ''}
            ${route.arcCount > 0 ? ` • 🔄${route.arcCount}` : ''}
          </div>
        </div>`;

        // Add analysis button
        html += `<div style="text-align:right;margin-top:2px;">
          <button onclick="window.__msdRoutingPanel?.analyzeRoute('${route.id}')"
            style="font-size:9px;padding:1px 4px;background:#333;color:#ccc;border:1px solid #555;border-radius:2px;cursor:pointer;">
            Analyze
          </button>
        </div>`;
      });

      if (filteredRoutes.length > 8) {
        html += `<div style="font-size:10px;text-align:center;color:#666;margin-top:4px;">
          ... ${filteredRoutes.length - 8} more routes
        </div>`;
      }

      html += '</div>';
    } else {
      html += '<div class="msd-hud-section">No routes match current filters</div>';
    }

    html += '</div>';
    return html;
  }
}
