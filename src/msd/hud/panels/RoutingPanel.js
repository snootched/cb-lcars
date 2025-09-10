/**
 * Enhanced Routing diagnostics panel for MSD HUD
 * Displays routing statistics and path computation data with filtering and analysis
 */

export class RoutingPanel {
  constructor() {
    this.filters = {
      strategy: 'all',
      minCost: 0,
      maxCost: 1500, // FIXED: Increased from 1000 to 1500
      cacheHit: 'all',
      showArcs: false
    };

    // FIXED: Track input focus to prevent refresh interference
    this.inputStates = {
      minCostFocused: false,
      maxCostFocused: false
    };
  }

  // ADDED: Former global handlers as instance methods
  setFilter(key, value) { this.filters[key] = value; }
  updateCostFilter(type, value) {
    const n = parseFloat(value);
    if (!isNaN(n)) this.filters[type] = n;
  }
  finalizeCostFilter() {}
  setInputFocus(field, focused) { this.inputStates[field] = focused; }
  highlightRoute(routeId) {
    console.log('[RoutingPanel] Highlighting route:', routeId);

    // FIXED: Use pipeline mount element instead of document for shadow DOM
    try {
      // Get the mount element from the pipeline/debug interface
      const mountElement = window.__msdDebug?.pipelineInstance?.mountElement ||
                          window.__msdDebug?.mountElement ||
                          document.querySelector('cb-lcars-msd-card')?.shadowRoot ||
                          document;

      if (!mountElement) {
        console.warn('[RoutingPanel] No mount element found for route highlighting');
        return;
      }

      // Try to find and highlight the actual route element in the mount's scope
      // Look for g elements with data-overlay-id (container) or path elements
      const routeElements = mountElement.querySelectorAll(`g[data-overlay-id="${routeId}"], path[data-overlay-id="${routeId}"], #${routeId}`);
      routeElements.forEach(element => {
        // Add temporary highlight class
        element.classList.add('msd-route-highlighted');
        setTimeout(() => {
          element.classList.remove('msd-route-highlighted');
        }, 3000);
      });

      // Also try to highlight any path elements within overlay groups
      const overlayGroups = mountElement.querySelectorAll(`g[data-overlay-id="${routeId}"]`);
      overlayGroups.forEach(group => {
        const paths = group.querySelectorAll('path');
        paths.forEach(path => {
          const originalStroke = path.style.stroke || path.getAttribute('stroke');
          const originalWidth = path.style.strokeWidth || path.getAttribute('stroke-width');

          // Highlight the path
          path.style.stroke = '#ff00ff';
          path.style.strokeWidth = '4';
          path.style.filter = 'drop-shadow(0 0 6px #ff00ff)';

          // Restore after 3 seconds
          setTimeout(() => {
            path.style.stroke = originalStroke;
            path.style.strokeWidth = originalWidth;
            path.style.filter = '';
          }, 3000);
        });
      });

      // Show user feedback
      this.showRouteHighlightFeedback(routeId);

    } catch (e) {
      console.warn('[RoutingPanel] Route highlighting failed:', e);
    }

    // Emit routing focus event for other panels
    if (window.__msdDebug?.hud?.emit) {
      window.__msdDebug.hud.emit('routing:focus', { id: routeId });
    }
  }

  analyzeRoute(routeId) {
    const routing = window.__msdDebug?.routing;
    if (routing?.inspect) {
      const analysis = routing.inspect(routeId);

      // FIXED: Enhanced route analysis display
      console.group(`🔍 Route Analysis: ${routeId}`);

      // Basic info table
      if (analysis.meta) {
        console.table({
          Strategy: analysis.meta.strategy || 'unknown',
          Cost: analysis.meta.cost || 0,
          Segments: analysis.meta.segments || 0,
          Bends: analysis.meta.bends || 0,
          'Cache Hit': analysis.meta.cache_hit ? '✅ Yes' : '❌ No'
        });
      }

      // Path details
      if (analysis.pts && analysis.pts.length > 0) {
        console.log('📍 Path Points:', analysis.pts.length, 'points');
        console.table(analysis.pts.map((pt, i) => ({
          Index: i,
          X: pt[0],
          Y: pt[1],
          Type: i === 0 ? 'Start' : i === analysis.pts.length - 1 ? 'End' : 'Waypoint'
        })));
      }

      // Hint information
      if (analysis.meta?.hint) {
        console.log('💡 Routing Hints:');
        console.table(analysis.meta.hint);
      }

      // SVG path data (truncated if long)
      if (analysis.d) {
        const pathData = analysis.d.length > 100 ? analysis.d.substring(0, 97) + '...' : analysis.d;
        console.log('🎨 SVG Path:', pathData);
      }

      // Raw object for developers who need it
      console.log('📋 Full Analysis Object:', analysis);
      console.groupEnd();

      // FIXED: Also show visual feedback in HUD
      this.showRouteAnalysisFeedback(routeId, analysis);
    }
  }

  // FIXED: Add visual feedback method
  showRouteHighlightFeedback(routeId) {
    // Create temporary feedback element
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 0, 255, 0.9);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000001;
      pointer-events: none;
    `;
    feedback.textContent = `Highlighting route: ${routeId}`;
    document.body.appendChild(feedback);

    setTimeout(() => {
      feedback.remove();
    }, 2000);
  }

  // FIXED: Add route analysis feedback method
  showRouteAnalysisFeedback(routeId, analysis) {
    // Create analysis popup
    const popup = document.createElement('div');
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      color: #00ffff;
      padding: 16px;
      border: 2px solid #00ffff;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000002;
      max-width: 400px;
      box-shadow: 0 4px 20px rgba(0, 255, 255, 0.3);
    `;

    let content = `<h3 style="margin:0 0 12px;color:#ffaa00;">Route Analysis: ${routeId}</h3>`;

    if (analysis.meta) {
      content += `
        <div style="margin-bottom:12px;">
          <div><strong>Strategy:</strong> ${analysis.meta.strategy || 'unknown'}</div>
          <div><strong>Cost:</strong> ${analysis.meta.cost || 0}</div>
          <div><strong>Segments:</strong> ${analysis.meta.segments || 0}</div>
          <div><strong>Bends:</strong> ${analysis.meta.bends || 0}</div>
          <div><strong>Cache Hit:</strong> ${analysis.meta.cache_hit ? '✅ Yes' : '❌ No'}</div>
        </div>
      `;
    }

    if (analysis.pts && analysis.pts.length > 0) {
      content += `
        <div style="margin-bottom:12px;">
          <strong>Path:</strong> ${analysis.pts.length} points<br>
          <div style="font-size:10px;margin-top:4px;">
            Start: (${analysis.pts[0][0]}, ${analysis.pts[0][1]})<br>
            End: (${analysis.pts[analysis.pts.length-1][0]}, ${analysis.pts[analysis.pts.length-1][1]})
          </div>
        </div>
      `;
    }

    if (analysis.meta?.hint) {
      content += `
        <div style="margin-bottom:12px;">
          <strong>Hints:</strong><br>
          <div style="font-size:10px;margin-top:4px;">
            First: ${analysis.meta.hint.first || 'n/a'} (${analysis.meta.hint.sourceFirst || 'n/a'})<br>
            Last: ${analysis.meta.hint.last || 'n/a'} (${analysis.meta.hint.sourceLast || 'n/a'})
          </div>
        </div>
      `;
    }

    content += `
      <div style="text-align:center;margin-top:12px;">
        <button onclick="this.parentElement.parentElement.remove()"
          style="background:#333;color:#fff;border:1px solid #555;padding:4px 12px;border-radius:4px;cursor:pointer;">
          Close
        </button>
      </div>
    `;

    popup.innerHTML = content;
    document.body.appendChild(popup);

    // Auto-close after 10 seconds
    setTimeout(() => {
      if (popup.parentElement) {
        popup.remove();
      }
    }, 10000);
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

    // FIXED: Add CSS for route highlighting
    html += `<style>
      .msd-route-highlighted {
        outline: 3px solid #ff00ff !important;
        background: rgba(255, 0, 255, 0.1) !important;
        box-shadow: 0 0 10px #ff00ff !important;
      }
    </style>`;

    // Filters section
    html += '<div class="msd-hud-section"><h4>Filters</h4>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">';

    // Strategy filter
    const strategies = ['all', 'auto', 'manhattan', 'smooth', 'direct'];
    html += '<select id="hud-routing-strategy" name="hud-routing-strategy" data-bus-event="routing:set-filter" data-key="strategy" onchange="__msdHudBus(\'routing:set-filter\', {key:\'strategy\', value:this.value})" style="font-size:10px;">';
    strategies.forEach(strategy => {
      const selected = this.filters.strategy === strategy ? 'selected' : '';
      html += `<option value="${strategy}" ${selected}>${strategy}</option>`;
    });
    html += '</select>';

    // FIXED: Cost range with better input handling
    html += `<input type="number" id="hud-routing-min-cost" name="hud-routing-min-cost"
      data-bus-event="routing:update-cost" data-key="minCost"
      onfocus="__msdHudBus('routing:focus-set',{field:'minCostFocused',focus:true})"
      onblur="__msdHudBus('routing:focus-set',{field:'minCostFocused',focus:false});__msdHudBus('routing:finalize-cost')"
      oninput="__msdHudBus('routing:update-cost',{key:'minCost',value:this.value})"
      placeholder="Min cost" value="${this.filters.minCost}" style="width:60px;font-size:10px;">`;

    html += `<input type="number" id="hud-routing-max-cost" name="hud-routing-max-cost"
      data-bus-event="routing:update-cost" data-key="maxCost"
      onfocus="__msdHudBus('routing:focus-set',{field:'maxCostFocused',focus:true})"
      onblur="__msdHudBus('routing:focus-set',{field:'maxCostFocused',focus:false});__msdHudBus('routing:finalize-cost')"
      oninput="__msdHudBus('routing:update-cost',{key:'maxCost',value:this.value})"
      placeholder="Max cost" value="${this.filters.maxCost}" style="width:60px;font-size:10px;">`;

    // Cache filter
    html += '<select id="hud-routing-cachehit" name="hud-routing-cachehit" data-bus-event="routing:set-filter" data-key="cacheHit" onchange="__msdHudBus(\'routing:set-filter\', {key:\'cacheHit\', value:this.value})" style="font-size:10px;">';
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

        // FIXED: Update data attribute for easier highlighting
        html += `<div class="msd-hud-metric"
          data-overlay-id="${route.id}"
          data-select-type="route"
          data-select-id="${route.id}"
          style="cursor:pointer;border:1px solid #333;padding:4px;margin:2px 0;border-radius:3px;transition:all 0.3s;"
          onclick="__msdHudBus('select:set',{type:'route',id:'${route.id}',source:'routing'});__msdHudBus('routing:highlight',{id:'${route.id}'})"
          onmouseover="this.style.background='rgba(255,0,255,0.1)'"
          onmouseout="this.style.background=''">
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
          <button data-bus-event="routing:analyze"
            onclick="__msdHudBus('select:set',{type:'route',id:'${route.id}',source:'routing'});__msdHudBus('routing:analyze',{id:'${route.id}'})"
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

  // FIXED: Add method to check if inputs are focused (prevents refresh interference)
  shouldSkipRefresh() {
    return this.inputStates.minCostFocused || this.inputStates.maxCostFocused;
  }
}
