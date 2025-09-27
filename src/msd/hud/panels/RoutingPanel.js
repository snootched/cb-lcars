import { cblcarsLog } from '../../../utils/cb-lcars-logging.js';
/**
 * [RoutingPanel] Enhanced routing diagnostics panel for MSD HUD
 * 🔀 Displays routing statistics and path computation data with filtering and analysis
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

    // ADDED: Set up global helper function for route analysis
    this._setupGlobalHelpers();
  }

  // ADDED: Setup global helper functions
  _setupGlobalHelpers() {
    // Global route analysis function that includes both console and popup
    window.__msdAnalyzeRoute = (routeId) => {
      cblcarsLog.info('[RoutingPanel] 🔍 Global analyze for:', routeId);

      const routing = window.__msdDebug?.routing;
      if (!routing?.inspect) {
        cblcarsLog.warn('[RoutingPanel] ⚠️ No routing inspector available');
        return;
      }

      const analysis = routing.inspect(routeId);

      // Console logging (same as before)
      console.group(`🔍 Route Analysis: ${routeId}`);

      if (analysis.meta) {
        console.table({
          Strategy: analysis.meta.strategy || 'unknown',
          Cost: analysis.meta.cost || 0,
          Segments: analysis.meta.segments || 0,
          Bends: analysis.meta.bends || 0,
          'Cache Hit': analysis.meta.cache_hit ? '✅ Yes' : '❌ No'
        });
      }

      if (analysis.pts && analysis.pts.length > 0) {
        console.log('📍 Path Points:', analysis.pts.length, 'points');
        console.table(analysis.pts.map((pt, i) => ({
          Index: i,
          X: pt[0],
          Y: pt[1],
          Type: i === 0 ? 'Start' : i === analysis.pts.length - 1 ? 'End' : 'Waypoint'
        })));
      }

      if (analysis.meta?.hint) {
        console.log('💡 Routing Hints:');
        console.table(analysis.meta.hint);
      }

      if (analysis.d) {
        const pathData = analysis.d.length > 100 ? analysis.d.substring(0, 97) + '...' : analysis.d;
        console.log('🎨 SVG Path:', pathData);
      }

      console.log('📋 Full Analysis Object:', analysis);
      console.groupEnd();

      // Show popup (same as showRouteAnalysisFeedback)
      this._showRouteAnalysisPopup(routeId, analysis);
    };
  }

  // ADDED: Show route analysis popup (extracted from showRouteAnalysisFeedback)
  _showRouteAnalysisPopup(routeId, analysis) {
    // Remove any existing popup
    const existing = document.getElementById('msd-route-analysis-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'msd-route-analysis-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      color: #00ffff;
      padding: 20px;
      border: 2px solid #00ffff;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000002;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 255, 255, 0.3);
    `;

    let content = `<h3 style="margin:0 0 16px;color:#ffaa00;">🔍 Route Analysis: ${routeId}</h3>`;

    // Basic routing information
    if (analysis.meta) {
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#88ccff;">📊 Routing Metrics</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;">
            <div><strong>Strategy:</strong> ${analysis.meta.strategy || 'unknown'}</div>
            <div><strong>Cost:</strong> <span style="color:#ffcc88;">${analysis.meta.cost || 0}</span></div>
            <div><strong>Segments:</strong> ${analysis.meta.segments || 0}</div>
            <div><strong>Bends:</strong> <span style="color:#ff99cc;">${analysis.meta.bends || 0}</span></div>
            <div><strong>Cache Hit:</strong> ${analysis.meta.cache_hit ? '<span style="color:#66ff99;">✅ Yes</span>' : '<span style="color:#ff6666;">❌ No</span>'}</div>
            <div><strong>Smooth:</strong> ${analysis.meta.smooth ? '✅ Yes' : '❌ No'}</div>
          </div>
        </div>
      `;
    }

    // Path points detail
    if (analysis.pts && analysis.pts.length > 0) {
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#88ccff;">📍 Path Points (${analysis.pts.length} total)</h4>
          <div style="font-size:10px;margin-bottom:8px;">
            <strong>Start:</strong> (${analysis.pts[0][0]}, ${analysis.pts[0][1]})<br>
            <strong>End:</strong> (${analysis.pts[analysis.pts.length-1][0]}, ${analysis.pts[analysis.pts.length-1][1]})
          </div>
      `;

      // Show all points if not too many, otherwise show first few and last few
      if (analysis.pts.length <= 8) {
        content += `<div style="font-size:10px;color:#ccc;">`;
        analysis.pts.forEach((pt, i) => {
          const type = i === 0 ? 'Start' : i === analysis.pts.length - 1 ? 'End' : 'Waypoint';
          content += `<div>${i}: (${pt[0]}, ${pt[1]}) - ${type}</div>`;
        });
        content += `</div>`;
      } else {
        content += `<div style="font-size:10px;color:#ccc;">`;
        // Show first 3 points
        for (let i = 0; i < 3; i++) {
          const pt = analysis.pts[i];
          const type = i === 0 ? 'Start' : 'Waypoint';
          content += `<div>${i}: (${pt[0]}, ${pt[1]}) - ${type}</div>`;
        }
        content += `<div style="color:#888;">... ${analysis.pts.length - 5} intermediate points ...</div>`;
        // Show last 2 points
        for (let i = analysis.pts.length - 2; i < analysis.pts.length; i++) {
          const pt = analysis.pts[i];
          const type = i === analysis.pts.length - 1 ? 'End' : 'Waypoint';
          content += `<div>${i}: (${pt[0]}, ${pt[1]}) - ${type}</div>`;
        }
        content += `</div>`;
      }
      content += `</div>`;
    }

    // Routing hints
    if (analysis.meta?.hint) {
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#88ccff;">💡 Routing Hints</h4>
          <div style="font-size:11px;color:#ccc;">
            <div><strong>First:</strong> ${analysis.meta.hint.first || 'n/a'}
                 <span style="color:#888;">(${analysis.meta.hint.sourceFirst || 'n/a'})</span></div>
            <div><strong>Last:</strong> ${analysis.meta.hint.last || 'n/a'}
                 <span style="color:#888;">(${analysis.meta.hint.sourceLast || 'n/a'})</span></div>
          </div>
        </div>
      `;
    }

    // SVG path data
    if (analysis.d) {
      const pathData = analysis.d;
      const isLong = pathData.length > 200;
      const displayPath = isLong ? pathData.substring(0, 197) + '...' : pathData;

      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#88ccff;">🎨 SVG Path Data</h4>
          <div style="font-size:10px;background:#111;padding:8px;border:1px solid #333;border-radius:4px;word-break:break-all;color:#ccc;font-family:monospace;">
            ${displayPath}
          </div>
          ${isLong ? '<div style="font-size:9px;color:#888;margin-top:4px;">Path truncated for display</div>' : ''}
        </div>
      `;
    }

    // Performance metrics (if available)
    if (analysis.meta?.compute_time_ms || analysis.meta?.cache_time_ms) {
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#88ccff;">⚡ Performance</h4>
          <div style="font-size:11px;color:#ccc;">
            ${analysis.meta.compute_time_ms ? `<div><strong>Compute Time:</strong> ${analysis.meta.compute_time_ms}ms</div>` : ''}
            ${analysis.meta.cache_time_ms ? `<div><strong>Cache Time:</strong> ${analysis.meta.cache_time_ms}ms</div>` : ''}
          </div>
        </div>
      `;
    }

    // Additional metadata
    const additionalMeta = Object.keys(analysis.meta || {}).filter(key =>
      !['strategy', 'cost', 'segments', 'bends', 'cache_hit', 'smooth', 'hint', 'compute_time_ms', 'cache_time_ms'].includes(key)
    );

    if (additionalMeta.length > 0) {
      content += `
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px;color:#88ccff;">🔧 Additional Metadata</h4>
          <div style="font-size:10px;color:#ccc;">
      `;
      additionalMeta.forEach(key => {
        const value = analysis.meta[key];
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
        content += `<div><strong>${key}:</strong> ${displayValue}</div>`;
      });
      content += `</div></div>`;
    }

    // Action buttons
    content += `
      <div style="text-align:center;margin-top:20px;border-top:1px solid #333;padding-top:16px;">
        <button onclick="navigator.clipboard.writeText(JSON.stringify(${JSON.stringify(analysis)}, null, 2)); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy Analysis', 2000);"
          style="background:#552255;color:#fff;border:1px solid #aa55aa;border-radius:4px;padding:6px 12px;cursor:pointer;margin-right:8px;font-size:11px;">
          Copy Analysis
        </button>
        <button onclick="this.parentElement.parentElement.remove()"
          style="background:#333;color:#fff;border:1px solid #555;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:11px;">
          Close
        </button>
      </div>
    `;

    popup.innerHTML = content;
    document.body.appendChild(popup);

    // REMOVED: Auto-close timeout - user must click close button
  }

  // ADDED: Former global handlers as instance methods
  setFilter(key, value) {
    this.filters[key] = value;
    cblcarsLog.debug(`[RoutingPanel] 🔧 Set filter ${key}: ${value}`);
  }
  updateCostFilter(type, value) {
    const n = parseFloat(value);
    if (!isNaN(n)) {
      this.filters[type] = n;
      cblcarsLog.debug(`[RoutingPanel] 💰 Updated cost filter ${type}: ${n}`);
    }
  }
  finalizeCostFilter() {
    cblcarsLog.debug('[RoutingPanel] ✅ Finalized cost filter changes');
  }
  setInputFocus(field, focused) {
    this.inputStates[field] = focused;
    cblcarsLog.debug(`[RoutingPanel] 🔍 Input focus ${field}: ${focused}`);
  }
  highlightRoute(routeId) {
    cblcarsLog.info('[RoutingPanel] 🎯 Highlighting route:', routeId);

    try {
      // Get the mount element from the pipeline/debug interface
      const mountElement = window.__msdDebug?.pipelineInstance?.mountElement ||
                          window.__msdDebug?.mountElement ||
                          document.querySelector('cb-lcars-msd-card')?.shadowRoot ||
                          document;

      if (!mountElement) {
        cblcarsLog.warn('[RoutingPanel] ⚠️ No mount element found for route highlighting');
        return;
      }

      // FIXED: Simpler, smaller glow effect with better cleanup
      const routeElements = mountElement.querySelectorAll(`g[data-overlay-id="${routeId}"], path[data-overlay-id="${routeId}"], #${routeId}`);
      const overlayGroups = mountElement.querySelectorAll(`g[data-overlay-id="${routeId}"]`);

      // Clear any existing highlights for this route first
      const existingHighlights = mountElement.querySelectorAll(`.msd-route-highlight-${routeId.replace(/[^a-zA-Z0-9]/g, '_')}`);
      existingHighlights.forEach(el => {
        el.style.filter = el.dataset.originalFilter || '';
        el.style.outline = el.dataset.originalOutline || '';
        el.style.removeProperty('outline-offset');
        el.classList.remove(`msd-route-highlight-${routeId.replace(/[^a-zA-Z0-9]/g, '_')}`);
        delete el.dataset.originalFilter;
        delete el.dataset.originalOutline;
      });

      // Apply highlight to route containers
      routeElements.forEach(element => {
        const safeId = routeId.replace(/[^a-zA-Z0-9]/g, '_');
        element.dataset.originalOutline = element.style.outline || '';

        // FIXED: Much smaller, subtler glow
        element.style.outline = '2px solid #ff00ff';
        element.style.outlineOffset = '1px';
        element.classList.add(`msd-route-highlight-${safeId}`);
      });

      // Apply highlight to paths within groups
      overlayGroups.forEach(group => {
        const paths = group.querySelectorAll('path');
        paths.forEach(path => {
          const safeId = routeId.replace(/[^a-zA-Z0-9]/g, '_');
          path.dataset.originalFilter = path.style.filter || '';

          // FIXED: Single, subtle glow instead of multiple layers
          path.style.filter = `drop-shadow(0 0 4px #ff00ff) ${path.dataset.originalFilter}`.trim();
          path.classList.add(`msd-route-highlight-${safeId}`);
        });
      });

      // Clean up after 3 seconds
      setTimeout(() => {
        const highlightedElements = mountElement.querySelectorAll(`.msd-route-highlight-${routeId.replace(/[^a-zA-Z0-9]/g, '_')}`);
        highlightedElements.forEach(element => {
          element.style.filter = element.dataset.originalFilter || '';
          element.style.outline = element.dataset.originalOutline || '';
          element.style.removeProperty('outline-offset');
          element.classList.remove(`msd-route-highlight-${routeId.replace(/[^a-zA-Z0-9]/g, '_')}`);
          delete element.dataset.originalFilter;
          delete element.dataset.originalOutline;
        });
      }, 3000);

      // Show user feedback
      this.showRouteHighlightFeedback(routeId);

    } catch (e) {
      cblcarsLog.warn('[RoutingPanel] ⚠️ Route highlighting failed:', e);
    }

    // Emit routing focus event for other panels
    if (window.__msdDebug?.hud?.emit) {
      window.__msdDebug.hud.emit('routing:focus', { id: routeId });
    }
  }  analyzeRoute(routeId) {
    cblcarsLog.info('[RoutingPanel] 🔍 analyzeRoute called with:', routeId);

    if (!routeId) {
      cblcarsLog.warn('[RoutingPanel] ⚠️ No route ID provided for analysis');
      return;
    }

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
    } else {
      cblcarsLog.warn('[RoutingPanel] ⚠️ No routing inspector available');
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
    }, 25000);
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
                cblcarsLog.warn(`[RoutingPanel] ⚠️ Route inspection failed for ${overlay.id}:`, e);
              }
            });
          }
        }
      }
    } catch (e) {
      cblcarsLog.warn('[RoutingPanel] ⚠️ Data capture failed:', e);
    }

    return { stats, routes, performance };
  }

  filterRoutes(routes) {
    const allRoutes = Object.values(routes);
    const filtered = allRoutes.filter(route => {
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

    cblcarsLog.debug(`[RoutingPanel] 📊 Filtered ${allRoutes.length} routes to ${filtered.length} matches`);
    return filtered;
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
          <div style="font-size:11px;color:#aaa;margin-top:3px;line-height:1.3;">
            <span style="color:#88ccff;">${route.strategy}</span> •
            <span style="color:#99dd99;" title="Path points">${route.pathLength} pts</span> •
            <span style="color:#ffcc88;" title="Direction changes">${route.bends} turns</span>
            ${route.cached ? ' • <span style="color:#66ddff;" title="Cached result">� cached</span>' : ''}
            ${route.arcCount > 0 ? ` • <span style="color:#ff99cc;" title="Arc segments">${route.arcCount} arcs</span>` : ''}
          </div>
        </div>`;

        // Add analysis button - Simplified approach with global helper
        html += `<div style="text-align:right;margin-top:2px;">
          <button
            onclick="event.stopPropagation();window.__msdAnalyzeRoute('${route.id}');"
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

  /**
   * Clean up panel resources
   */
  destroy() {
    // Clear filter state
    this.filters = null;

    // Clear input states
    this.inputStates = null;

    // Remove global helper functions
    if (typeof window !== 'undefined') {
      delete window.__msdAnalyzeRoute;
    }

    cblcarsLog.debug(`[MSD:${this.constructor.name}] Panel cleanup completed`);
  }

  // FIXED: Add method to check if inputs are focused (prevents refresh interference)
  shouldSkipRefresh() {
    return this.inputStates.minCostFocused || this.inputStates.maxCostFocused;
  }
}
