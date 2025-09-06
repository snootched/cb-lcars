/**
 * Phase 2: Debug visualization renderer
 * Shows anchor markers, overlay bounding boxes, routing guidelines, performance overlays.
 * Handles timing resilience for systems that may not be fully initialized at first render.
 */
export class MsdDebugRenderer {
  constructor() {
    this.enabled = false;
    this.debugLayer = null;
    this.anchorMarkers = new Map();
    this.boundingBoxes = new Map();
    this.routingOverlays = new Map();
    this.performanceOverlays = new Map();

    this.scale = 1.0;

    // Remove old feature flags - now managed by DebugManager
    this.debugManager = null;
    this.unsubscribeDebug = null;

    // Store last render context for reactive re-renders
    this._lastRenderContext = null;

    // Remove retry mechanism - no longer needed
  }

  /**
   * Initialize with systems manager and subscribe to debug changes
   * @param {SystemsManager} systemsManager - Systems manager instance
   */
  init(systemsManager) {
    this.debugManager = systemsManager.debugManager;

    // Subscribe to debug state changes for reactive rendering
    this.unsubscribeDebug = this.debugManager.onChange((event) => {
      console.log('[MsdDebugRenderer] Debug state changed:', event.type);

      if (event.type === 'feature' || event.type === 'scale' || event.type === 'router-ready') {
        this._scheduleRerender();
      }
    });

    console.log('[MsdDebugRenderer] Initialized with DebugManager subscription');
  }

  /**
   * Set scale factor from debug configuration
   * @param {number} scale - Scale multiplier (default 1.0)
   */
  setScale(scale = 1.0) {
    this.scale = Math.max(0.3, Math.min(3.0, scale)); // Clamp between reasonable bounds
    console.log(`[MsdDebugRenderer] Scale factor set to: ${this.scale}`);
  }

  /**
   * Main render method - now powered by DebugManager state
   * @param {Element} root - DOM root element
   * @param {Array} viewBox - SVG viewBox [x, y, width, height]
   * @param {Object} opts - Render options
   */
  render(root, viewBox, opts = {}) {
    console.log('[MsdDebugRenderer] render() called with:', {
      root: !!root,
      rootType: root?.constructor?.name,
      viewBox: viewBox,
      opts: opts,
      debugManagerReady: !!(this.debugManager && this.debugManager.initialized)
    });

    // Store context for reactive re-renders
    this._lastRenderContext = { root, viewBox, opts };

    if (!this.debugManager || !this.debugManager.initialized) {
      console.warn('[MsdDebugRenderer] DebugManager not ready, skipping render');
      return;
    }

    const debugState = this.debugManager.getSnapshot();
    console.log('[MsdDebugRenderer] DebugManager state:', debugState);

    if (!root || typeof root.querySelector !== 'function') {
      console.warn('[MsdDebugRenderer] Invalid root element - root:', root);
      return;
    }

    const svgElement = root.querySelector('svg');
    if (!svgElement) {
      console.warn('[MsdDebugRenderer] No SVG element found in root');
      // Try to find SVG in different locations
      console.log('[MsdDebugRenderer] Root HTML:', root.innerHTML?.slice(0, 200) + '...');
      return;
    }

    console.log('[MsdDebugRenderer] Found SVG element:', svgElement.tagName);

    // Update scale from DebugManager
    this.setScale(debugState.scale);

    // Setup debug layer
    this.integrateWithAdvancedRenderer(svgElement, viewBox, opts.anchors);

    // Clear existing debug content
    if (this.debugLayer) {
      this.debugLayer.innerHTML = '';
      console.log('[MsdDebugRenderer] Cleared debug layer');
    }

    // Exit early if no features enabled
    if (!debugState.enabled) {
      if (this.debugLayer) {
        this.debugLayer.style.display = 'none';
      }
      console.log('[MsdDebugRenderer] Debug not enabled, hiding layer');
      return;
    }

    console.log('[MsdDebugRenderer] Rendering features:', {
      anchors: debugState.anchors && !!opts.anchors,
      boundingBoxes: debugState.bounding_boxes && !!opts.overlays,
      routing: debugState.routing && this.debugManager.canRenderRouting(),
      performance: debugState.performance
    });

    // Render enabled features using DebugManager state
    if (debugState.anchors && opts.anchors) {
      console.log('[MsdDebugRenderer] Rendering anchors...');
      this.renderAnchorMarkers(opts.anchors);
    }

    if (debugState.bounding_boxes && opts.overlays) {
      console.log('[MsdDebugRenderer] Rendering bounding boxes...');
      this.renderOverlayBounds(opts.overlays);
    }

    if (debugState.routing && this.debugManager.canRenderRouting()) {
      console.log('[MsdDebugRenderer] Rendering routing guides...');
      this.renderRoutingGuides(opts);
    }

    if (debugState.performance) {
      console.log('[MsdDebugRenderer] Rendering performance overlays...');
      this.renderPerformanceOverlays(opts);
    }

    // Show debug layer
    if (this.debugLayer) {
      this.debugLayer.style.display = 'block';
      console.log('[MsdDebugRenderer] ✅ Debug layer shown');
    }

    console.log('[MsdDebugRenderer] Debug features rendered via DebugManager');
  }

  /**
   * Schedule a reactive re-render
   * @private
   */
  _scheduleRerender() {
    if (this._lastRenderContext) {
      // Use requestAnimationFrame to avoid excessive re-renders
      requestAnimationFrame(() => {
        const { root, viewBox, opts } = this._lastRenderContext;
        this.render(root, viewBox, opts);
      });
    }
  }

  /**
   * Render routing guides - simplified without retry mechanism
   * @param {Object} opts - Render options
   */
  renderRoutingGuides(opts) {
    if (!this.debugLayer) return;

    // Clear existing routes
    this.routingOverlays.forEach(o => o.remove());
    this.routingOverlays.clear();

    // Get routing system from window.__msdDebug (set by pipeline)
    const routing = opts.router || window.__msdDebug?.routing;

    if (!routing || typeof routing.inspect !== 'function') {
      console.log('[MsdDebugRenderer] Routing system not available for debug rendering');
      return;
    }

    const overlays = opts.overlays || [];
    const lineOverlays = overlays.filter(o => o.type === 'line');

    if (lineOverlays.length === 0) {
      console.log('[MsdDebugRenderer] No line overlays found for routing visualization');
      return;
    }

    let routeCount = 0;
    lineOverlays.forEach(overlay => {
      try {
        const routeInfo = routing.inspect(overlay.id);
        if (routeInfo && routeInfo.pts && routeInfo.pts.length > 1) {
          const routeOverlay = this.createRoutingOverlay(overlay.id, routeInfo);
          this.debugLayer.appendChild(routeOverlay);
          this.routingOverlays.set(overlay.id, routeOverlay);
          routeCount++;
        } else {
          // Fine-grained debug, not necessarily an error
          console.log(`[MsdDebugRenderer] No route info for overlay ${overlay.id}`);
        }
      } catch (error) {
        console.warn(`[MsdDebugRenderer] Failed to render routing guide for ${overlay.id}:`, error);
      }
    });

    console.log(`[MsdDebugRenderer] Rendered ${routeCount} routing guides`);
  }

  /**
   * Create routing visualization overlay group.
   * @param {string} overlayId
   * @param {Object} routeInfo
   * @returns {SVGGElement}
   */
  createRoutingOverlay(overlayId, routeInfo) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'msd-debug-routing');

    const points = routeInfo.pts || [];
    points.forEach((pt, index) => {
      if (Array.isArray(pt) && pt.length >= 2) {
        const [x, y] = pt;
        const waypoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        waypoint.setAttribute('cx', x);
        waypoint.setAttribute('cy', y);
        waypoint.setAttribute('r', 2 * this.scale);
        waypoint.setAttribute('fill', 'magenta');
        waypoint.setAttribute('stroke', 'white');
        waypoint.setAttribute('stroke-width', 1 * this.scale);
        waypoint.setAttribute('opacity', '0.8');
        group.appendChild(waypoint);

        if (index === 0 || index === points.length - 1 || points.length <= 6) {
          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', x + (4 * this.scale));
            label.setAttribute('y', y - (4 * this.scale));
            label.setAttribute('fill', 'magenta');
            label.setAttribute('font-size', 8 * this.scale);
            label.setAttribute('font-family', 'monospace');
            label.setAttribute('opacity', '0.8');
            label.textContent = index;
            group.appendChild(label);
        }
      }
    });

    if (routeInfo.meta) {
      const startPt = points[0];
      if (startPt && Array.isArray(startPt) && startPt.length >= 2) {
        const info = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        info.setAttribute('x', startPt[0]);
        info.setAttribute('y', startPt[1] - (12 * this.scale));
        info.setAttribute('fill', 'magenta');
        info.setAttribute('font-size', 9 * this.scale);
        info.setAttribute('font-family', 'monospace');
        info.setAttribute('opacity', '0.9');
        info.textContent = `${routeInfo.meta.strategy || 'auto'} (${Math.round(routeInfo.meta.cost || 0)})`;
        group.appendChild(info);
      }
    }

    return group;
  }

  /**
   * Render anchor markers
   * @param {Object} anchors
   */
  renderAnchorMarkers(anchors) {
    if (!anchors || !this.debugLayer) return;

    this.anchorMarkers.forEach(marker => marker.remove());
    this.anchorMarkers.clear();

    let markerCount = 0;
    for (const [name, pt] of Object.entries(anchors)) {
      if (Array.isArray(pt) && pt.length >= 2) {
        const marker = this.createAnchorMarker(name, pt[0], pt[1]);
        this.debugLayer.appendChild(marker);
        this.anchorMarkers.set(name, marker);
        markerCount++;
      }
    }

    console.log(`[MsdDebugRenderer] Rendered ${markerCount} anchor markers`);
  }

  /**
   * Create individual anchor marker group element
   * @param {string} name
   * @param {number} x
   * @param {number} y
   * @returns {SVGGElement}
   */
  createAnchorMarker(name, x, y) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('transform', `translate(${x}, ${y})`);
    group.setAttribute('class', 'msd-debug-anchor');

    const crosshairSize = 8 * this.scale;
    const strokeWidth = 2 * this.scale;
    const circleRadius = 3 * this.scale;
    const fontSize = 12 * this.scale;
    const labelOffset = 12 * this.scale;

    const crosshair = `
      <line x1="${-crosshairSize}" y1="0" x2="${crosshairSize}" y2="0" stroke="cyan" stroke-width="${strokeWidth}" opacity="0.8"/>
      <line x1="0" y1="${-crosshairSize}" x2="0" y2="${crosshairSize}" stroke="cyan" stroke-width="${strokeWidth}" opacity="0.8"/>
      <circle cx="0" cy="0" r="${circleRadius}" fill="cyan" stroke="white" stroke-width="${this.scale}" opacity="0.9"/>
    `;
    const label = `
      <text x="${labelOffset}" y="4" fill="cyan" font-size="${fontSize}" font-family="monospace" opacity="0.9">
        ${name} (${Math.round(x)}, ${Math.round(y)})
      </text>
    `;

    group.innerHTML = crosshair + label;
    return group;
  }

  /**
   * Render overlay bounding boxes
   * @param {Array<Object>} overlays
   */
  renderOverlayBounds(overlays = []) {
    if (!this.debugLayer) return;

    this.boundingBoxes.forEach((bboxObj) => {
      bboxObj.rect?.remove();
      bboxObj.label?.remove();
    });
    this.boundingBoxes.clear();

    let bboxCount = 0;
    overlays.forEach(overlay => {
      if (overlay.position && Array.isArray(overlay.position)) {
        const [x, y] = overlay.position;
        const width = overlay.size ? overlay.size[0] : 100;
        const height = overlay.size ? overlay.size[1] : 20;

        const bboxObj = this.createBoundingBox(overlay.id, x, y, width, height);
        this.debugLayer.appendChild(bboxObj.rect);
        this.debugLayer.appendChild(bboxObj.label);
        this.boundingBoxes.set(overlay.id, bboxObj);
        bboxCount++;
      }
    });

    console.log(`[MsdDebugRenderer] Rendered ${bboxCount} bounding boxes`);
  }

  /**
   * Create bounding box visualization objects
   * @param {string} id
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @returns {{rect: SVGRectElement, label: SVGTextElement}}
   */
  createBoundingBox(id, x, y, width, height) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', 'orange');
    rect.setAttribute('stroke-width', 1 * this.scale);
    rect.setAttribute('stroke-dasharray', `${3 * this.scale},${3 * this.scale}`);
    rect.setAttribute('opacity', '0.7');
    rect.setAttribute('class', 'msd-debug-bbox');

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', x + (2 * this.scale));
    label.setAttribute('y', y + (12 * this.scale));
    label.setAttribute('fill', 'orange');
    label.setAttribute('font-size', 10 * this.scale);
    label.setAttribute('font-family', 'monospace');
    label.setAttribute('opacity', '0.9');
    label.textContent = id || 'unknown';
    label.setAttribute('class', 'msd-debug-bbox-label');

    return { rect, label };
  }

  /**
   * Render performance overlays - with proper value formatting
   * @param {Object} opts
   */
  renderPerformanceOverlays(opts) {
    if (!this.debugLayer) return;

    this.performanceOverlays.forEach(o => o.remove());
    this.performanceOverlays.clear();

    const perf = window.__msdDebug?.getPerf?.() || {};
    const perfEntries = [];

    if (perf.timers) {
      Object.entries(perf.timers).forEach(([key, data]) => {
        if (data && typeof data === 'object') {
          const avg = data.count > 0 ? (data.total / data.count) : 0;
            perfEntries.push(`${key}: ${avg.toFixed(2)}ms avg`);
        }
      });
    }

    if (perf.counters) {
      Object.entries(perf.counters).forEach(([key, value]) => {
        perfEntries.push(`${key}: ${value}`);
      });
    }

    if (perfEntries.length === 0) {
      Object.entries(perf).slice(0, 10).forEach(([key, value]) => {
        let displayValue;
        if (typeof value === 'object' && value !== null) {
          if (value.count !== undefined && value.total !== undefined) {
            const avg = value.count > 0 ? (value.total / value.count) : 0;
            displayValue = `${avg.toFixed(2)}ms avg`;
          } else {
            displayValue = JSON.stringify(value);
          }
        } else {
          displayValue = String(value);
        }
        perfEntries.push(`${key}: ${displayValue}`);
      });
    }

    if (perfEntries.length === 0) {
      console.log('[MsdDebugRenderer] No performance data available');
      return;
    }

    const perfGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    perfGroup.setAttribute('class', 'msd-debug-performance');

    const baseX = 10 * this.scale;
    const baseY = 10 * this.scale;
    const width = 200 * this.scale;
    const padding = 5 * this.scale;

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', baseX);
    bg.setAttribute('y', baseY);
    bg.setAttribute('width', width);
    bg.setAttribute('height', (20 + perfEntries.slice(0, 8).length * 15) * this.scale);
    bg.setAttribute('fill', 'rgba(0,0,0,0.8)');
    bg.setAttribute('stroke', 'yellow');
    bg.setAttribute('stroke-width', 1 * this.scale);
    bg.setAttribute('rx', 4 * this.scale);
    perfGroup.appendChild(bg);

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', baseX + padding);
    title.setAttribute('y', baseY + (15 * this.scale));
    title.setAttribute('fill', 'yellow');
    title.setAttribute('font-size', 12 * this.scale);
    title.setAttribute('font-family', 'monospace');
    title.setAttribute('font-weight', 'bold');
    title.textContent = 'Performance';
    perfGroup.appendChild(title);

    perfEntries.slice(0, 8).forEach((entryText, index) => {
      const entry = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      entry.setAttribute('x', baseX + padding);
      entry.setAttribute('y', baseY + (30 + index * 15) * this.scale);
      entry.setAttribute('fill', 'yellow');
      entry.setAttribute('font-size', 10 * this.scale);
      entry.setAttribute('font-family', 'monospace');
      entry.textContent = entryText;
      perfGroup.appendChild(entry);
    });

    this.debugLayer.appendChild(perfGroup);
    this.performanceOverlays.set('perf-info', perfGroup);

    console.log(`[MsdDebugRenderer] Rendered performance overlay with ${perfEntries.length} metrics at scale ${this.scale}`);
  }

  /**
   * Connect to AdvancedRenderer's SVG structure
   * @param {SVGElement} svgElement
   * @param {Array} viewBox
   * @param {Object} anchors
   */
  integrateWithAdvancedRenderer(svgElement, viewBox, anchors = {}) {
    if (!svgElement) return;
    this.ensureDebugLayer(svgElement);
    this.viewBox = viewBox;
    this.anchors = anchors;
  }

  /**
   * Setup debug layer container group inside the SVG.
   * @param {SVGElement} svgElement
   */
  ensureDebugLayer(svgElement) {
    if (!svgElement) {
      console.warn('[MsdDebugRenderer] ensureDebugLayer: no SVG element provided');
      return;
    }

    let debugLayer = svgElement.querySelector('#msd-debug-layer');
    if (!debugLayer) {
      console.log('[MsdDebugRenderer] Creating new debug layer');
      debugLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      debugLayer.id = 'msd-debug-layer';
      debugLayer.style.pointerEvents = 'none';
      debugLayer.style.zIndex = '1000';
      svgElement.appendChild(debugLayer);
    } else {
      console.log('[MsdDebugRenderer] Using existing debug layer');
    }

    this.debugLayer = debugLayer;
  }

  /**
   * Toggle debug visualization on/off.
   * @param {boolean} enabled
   * @returns {boolean}
   */
  toggle(enabled = !this.enabled) {
    this.enabled = enabled;
    if (this.debugLayer) {
      this.debugLayer.style.display = enabled ? 'block' : 'none';
    }
    console.log(`[MsdDebugRenderer] Debug visualization ${enabled ? 'enabled' : 'disabled'}`);
    return enabled;
  }

  /**
   * Toggle a specific debug feature.
   * @param {string} feature - Feature key
   * @param {boolean} enabled - Desired state
   */
  toggleFeature(feature, enabled) {
    if (this.features.hasOwnProperty(feature)) {
      this.features[feature] = enabled;
      console.log(`[MsdDebugRenderer] Feature '${feature}' ${enabled ? 'enabled' : 'disabled'}`);

      // Optionally re-render (future HUD integration may call up-stream)
      setTimeout(() => {
        if (this._lastRenderContext) {
          const { root, viewBox, opts } = this._lastRenderContext;
          this.render(root, viewBox, opts);
        }
      }, 10);
    }
  }

  /**
   * Get current debug state summary.
   * @returns {Object}
   */
  getDebugState() {
    return {
      enabled: this.enabled,
      features: { ...this.features },
      hasDebugLayer: Boolean(this.debugLayer),
      markerCount: this.anchorMarkers.size,
      boundingBoxCount: this.boundingBoxes.size,
      routingOverlayCount: this.routingOverlays.size,
      performanceOverlayCount: this.performanceOverlays.size
    };
  }

  /**
   * Cleanup subscriptions
   */
  destroy() {
    if (this.unsubscribeDebug) {
      this.unsubscribeDebug();
      this.unsubscribeDebug = null;
    }
  }
}

// Keep browser fallback for direct script loading
if (typeof window !== 'undefined') {
  window.cblcars = window.cblcars || {};
  window.cblcars.MsdDebugRenderer = MsdDebugRenderer;
}