/**
 * Phase 2: Debug visualization renderer
 * Shows anchor markers, overlay bounding boxes, routing guidelines, performance overlays
 */

export class MsdDebugRenderer {
  constructor() {
    this.enabled = false;
    this.debugLayer = null;
    this.anchorMarkers = new Map();
    this.boundingBoxes = new Map();
    this.routingOverlays = new Map();
    this.performanceOverlays = new Map();

    // Add scale factor
    this.scale = 1.0; // Default scale

    // Track individual debug feature states
    this.features = {
      anchors: false,
      bounding_boxes: false,
      routing: false,
      performance: false
    };
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
   * Main render method - now properly respects debug config
   * @param {Element} root - DOM root element
   * @param {Array} viewBox - SVG viewBox [x, y, width, height]
   * @param {Object} opts - Render options including debug config
   */
  render(root, viewBox, opts = {}) {
    console.log('[MsdDebugRenderer] render() called with options:', opts);

    // Check if root is a valid DOM element with querySelector
    if (!root || typeof root.querySelector !== 'function') {
      console.warn('[MsdDebugRenderer] Invalid root element - missing querySelector method');
      return;
    }

    const svgElement = root.querySelector('svg');
    if (!svgElement) {
      console.warn('[MsdDebugRenderer] No SVG element found in root');
      return;
    }

    // Set scale factor from options
    if (opts.scale !== undefined) {
      this.setScale(opts.scale);
    }

    // Setup debug layer
    this.integrateWithAdvancedRenderer(svgElement, viewBox, opts.anchors);

    // Clear existing debug content
    if (this.debugLayer) {
      this.debugLayer.innerHTML = '';
    }

    // Update feature states based on options
    this.updateFeatureStates(opts);

    // Render enabled features
    this.renderEnabledFeatures(opts);

    // Show/hide debug layer based on whether any features are enabled
    const anyEnabled = Object.values(this.features).some(enabled => enabled);
    if (this.debugLayer) {
      this.debugLayer.style.display = anyEnabled ? 'block' : 'none';
    }

    console.log('[MsdDebugRenderer] Debug features rendered:', this.features);
  }

  /**
   * Update internal feature states based on render options
   */
  updateFeatureStates(opts) {
    this.features.anchors = Boolean(opts.showAnchors);
    this.features.bounding_boxes = Boolean(opts.showBoundingBoxes);
    this.features.routing = Boolean(opts.showRouting);
    this.features.performance = Boolean(opts.showPerformance);
  }

  /**
   * Render all enabled debug features
   */
  renderEnabledFeatures(opts) {
    if (this.features.anchors && opts.anchors) {
      console.log('[MsdDebugRenderer] Rendering anchor markers');
      this.renderAnchorMarkers(opts.anchors);
    }

    if (this.features.bounding_boxes && opts.overlays) {
      console.log('[MsdDebugRenderer] Rendering bounding boxes');
      this.renderOverlayBounds(opts.overlays);
    }

    if (this.features.routing) {
      console.log('[MsdDebugRenderer] Rendering routing guides');
      this.renderRoutingGuides(opts);
    }

    if (this.features.performance) {
      console.log('[MsdDebugRenderer] Rendering performance overlays');
      this.renderPerformanceOverlays(opts);
    }
  }

  /**
   * Find SVG element in DOM
   */
  findSvgElement() {
    // Try multiple strategies to find SVG
    const strategies = [
      () => document.querySelector('svg'),
      () => document.querySelector('[id*="msd"] svg'),
      () => document.querySelector('.card-content svg'),
      () => document.querySelector('ha-card svg')
    ];

    for (const strategy of strategies) {
      try {
        const svg = strategy();
        if (svg) return svg;
      } catch (e) {
        // Continue to next strategy
      }
    }

    return null;
  }

  /**
   * Setup debug layer in SVG
   */
  ensureDebugLayer(svgElement) {
    if (!svgElement) return;

    let debugLayer = svgElement.querySelector('#msd-debug-layer');
    if (!debugLayer) {
      debugLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      debugLayer.id = 'msd-debug-layer';
      debugLayer.style.pointerEvents = 'none';
      debugLayer.style.zIndex = '1000';
      svgElement.appendChild(debugLayer);
    }

    this.debugLayer = debugLayer;
  }

  /**
   * Render anchor markers
   */
  renderAnchorMarkers(anchors) {
    if (!anchors || !this.debugLayer) return;

    // Clear existing anchor markers
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
   * Create individual anchor marker
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

    // Crosshair
    const crosshair = `
      <line x1="${-crosshairSize}" y1="0" x2="${crosshairSize}" y2="0" stroke="cyan" stroke-width="${strokeWidth}" opacity="0.8"/>
      <line x1="0" y1="${-crosshairSize}" x2="0" y2="${crosshairSize}" stroke="cyan" stroke-width="${strokeWidth}" opacity="0.8"/>
      <circle cx="0" cy="0" r="${circleRadius}" fill="cyan" stroke="white" stroke-width="${this.scale}" opacity="0.9"/>
    `;

    // Label
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
   */
  renderOverlayBounds(overlays = []) {
    if (!this.debugLayer) return;

    // Clear existing bounding boxes
    this.boundingBoxes.forEach((bboxObj, id) => {
      // bboxObj is { rect, label } - remove both elements
      if (bboxObj.rect && bboxObj.rect.remove) {
        bboxObj.rect.remove();
      }
      if (bboxObj.label && bboxObj.label.remove) {
        bboxObj.label.remove();
      }
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
   * Create bounding box visualization
   */
  createBoundingBox(id, x, y, width, height) {
    // Rectangle
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

    // Label
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
   * Render routing guides
   */
  renderRoutingGuides(opts) {
    if (!this.debugLayer) return;

    // Clear existing routing overlays
    this.routingOverlays.forEach(overlay => overlay.remove());
    this.routingOverlays.clear();

    // Get routing information from debug system
    const routing = window.__msdDebug?.routing;
    if (!routing) {
      console.warn('[MsdDebugRenderer] No routing system available for debug visualization');
      return;
    }

    // FIX: Also check if routing.inspect is available (timing issue)
    if (!routing.inspect || typeof routing.inspect !== 'function') {
      console.warn('[MsdDebugRenderer] Routing system not fully initialized yet');
      return;
    }

    // Get line overlays from model
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
          console.log(`[MsdDebugRenderer] No route info available for overlay ${overlay.id}`);
        }
      } catch (error) {
        console.warn(`[MsdDebugRenderer] Failed to render routing guide for ${overlay.id}:`, error);
      }
    });

    console.log(`[MsdDebugRenderer] Rendered ${routeCount} routing guides`);
  }

  /**
   * Create routing visualization overlay
   */
  createRoutingOverlay(overlayId, routeInfo) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'msd-debug-routing');

    // Draw waypoints
    const points = routeInfo.pts || [];
    points.forEach((pt, index) => {
      if (Array.isArray(pt) && pt.length >= 2) {
        const [x, y] = pt;

        // Waypoint marker
        const waypoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        waypoint.setAttribute('cx', x);
        waypoint.setAttribute('cy', y);
        waypoint.setAttribute('r', 2 * this.scale);
        waypoint.setAttribute('fill', 'magenta');
        waypoint.setAttribute('stroke', 'white');
        waypoint.setAttribute('stroke-width', 1 * this.scale);
        waypoint.setAttribute('opacity', '0.8');
        group.appendChild(waypoint);

        // Index label
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

    // Strategy and cost info
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
   * Render performance overlays - with scaling
   */
  /*
  renderPerformanceOverlays(opts) {
    if (!this.debugLayer) return;

    // Clear existing performance overlays
    this.performanceOverlays.forEach(overlay => overlay.remove());
    this.performanceOverlays.clear();

    // Get performance data
    const perf = window.__msdDebug?.getPerf?.() || {};
    const perfKeys = Object.keys(perf).slice(0, 10); // Limit to top 10

    if (perfKeys.length === 0) {
      console.log('[MsdDebugRenderer] No performance data available');
      return;
    }

    // Create performance info overlay
    const perfGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    perfGroup.setAttribute('class', 'msd-debug-performance');

    // Scaled dimensions
    const baseX = 10 * this.scale;
    const baseY = 10 * this.scale;
    const width = 200 * this.scale;
    const lineHeight = 15 * this.scale;
    const padding = 5 * this.scale;

    // Background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', baseX);
    bg.setAttribute('y', baseY);
    bg.setAttribute('width', width);
    bg.setAttribute('height', (20 + perfKeys.length * 15) * this.scale);
    bg.setAttribute('fill', 'rgba(0,0,0,0.8)');
    bg.setAttribute('stroke', 'yellow');
    bg.setAttribute('stroke-width', 1 * this.scale);
    bg.setAttribute('rx', 4 * this.scale);
    perfGroup.appendChild(bg);

    // Title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', baseX + padding);
    title.setAttribute('y', baseY + (15 * this.scale));
    title.setAttribute('fill', 'yellow');
    title.setAttribute('font-size', 12 * this.scale);
    title.setAttribute('font-family', 'monospace');
    title.setAttribute('font-weight', 'bold');
    title.textContent = 'Performance';
    perfGroup.appendChild(title);

    // Performance entries
    perfKeys.forEach((key, index) => {
      const entry = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      entry.setAttribute('x', baseX + padding);
      entry.setAttribute('y', baseY + (30 + index * 15) * this.scale);
      entry.setAttribute('fill', 'yellow');
      entry.setAttribute('font-size', 10 * this.scale);
      entry.setAttribute('font-family', 'monospace');
      entry.textContent = `${key}: ${perf[key]}`;
      perfGroup.appendChild(entry);
    });

    this.debugLayer.appendChild(perfGroup);
    this.performanceOverlays.set('perf-info', perfGroup);

    console.log(`[MsdDebugRenderer] Rendered performance overlay with ${perfKeys.length} metrics at scale ${this.scale}`);
  }
  */


  /**
   * Render performance overlays - with proper value formatting
   */
  renderPerformanceOverlays(opts) {
    if (!this.debugLayer) return;

    // Clear existing performance overlays
    this.performanceOverlays.forEach(overlay => overlay.remove());
    this.performanceOverlays.clear();

    // Get performance data
    const perf = window.__msdDebug?.getPerf?.() || {};

    // Extract meaningful data from the performance object
    const perfEntries = [];

    // Add timers with formatted values
    if (perf.timers) {
      Object.entries(perf.timers).forEach(([key, data]) => {
        if (data && typeof data === 'object') {
          const avg = data.count > 0 ? (data.total / data.count) : 0;
          perfEntries.push(`${key}: ${avg.toFixed(2)}ms avg`);
        }
      });
    }

    // Add counters
    if (perf.counters) {
      Object.entries(perf.counters).forEach(([key, value]) => {
        perfEntries.push(`${key}: ${value}`);
      });
    }

    // Fallback: if structure is different, try to display raw values
    if (perfEntries.length === 0) {
      Object.entries(perf).slice(0, 10).forEach(([key, value]) => {
        // Format the value properly
        let displayValue;
        if (typeof value === 'object' && value !== null) {
          // Try to extract meaningful info from object
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

    // Create performance info overlay
    const perfGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    perfGroup.setAttribute('class', 'msd-debug-performance');

    // Scaled dimensions
    const baseX = 10 * this.scale;
    const baseY = 10 * this.scale;
    const width = 200 * this.scale;
    const lineHeight = 15 * this.scale;
    const padding = 5 * this.scale;

    // Background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', baseX);
    bg.setAttribute('y', baseY);
    bg.setAttribute('width', width);
    bg.setAttribute('height', (20 + perfEntries.length * 15) * this.scale);
    bg.setAttribute('fill', 'rgba(0,0,0,0.8)');
    bg.setAttribute('stroke', 'yellow');
    bg.setAttribute('stroke-width', 1 * this.scale);
    bg.setAttribute('rx', 4 * this.scale);
    perfGroup.appendChild(bg);

    // Title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', baseX + padding);
    title.setAttribute('y', baseY + (15 * this.scale));
    title.setAttribute('fill', 'yellow');
    title.setAttribute('font-size', 12 * this.scale);
    title.setAttribute('font-family', 'monospace');
    title.setAttribute('font-weight', 'bold');
    title.textContent = 'Performance';
    perfGroup.appendChild(title);

    // Performance entries - limit to fit in overlay
    perfEntries.slice(0, 8).forEach((entryText, index) => {
      const entry = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      entry.setAttribute('x', baseX + padding);
      entry.setAttribute('y', baseY + (30 + index * 15) * this.scale);
      entry.setAttribute('fill', 'yellow');
      entry.setAttribute('font-size', 10 * this.scale);
      entry.setAttribute('font-family', 'monospace');
      entry.textContent = entryText; // Now properly formatted
      perfGroup.appendChild(entry);
    });

    this.debugLayer.appendChild(perfGroup);
    this.performanceOverlays.set('perf-info', perfGroup);

    console.log(`[MsdDebugRenderer] Rendered performance overlay with ${perfEntries.length} metrics at scale ${this.scale}`);
  }


  /**
   * Connect to AdvancedRenderer's SVG structure
   */
  integrateWithAdvancedRenderer(svgElement, viewBox, anchors = {}) {
    if (!svgElement) return;

    this.ensureDebugLayer(svgElement);
    this.viewBox = viewBox;
    this.anchors = anchors;
  }

  /**
   * Toggle debug visualization
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
   * Enable/disable specific debug features
   */
  toggleFeature(feature, enabled) {
    if (this.features.hasOwnProperty(feature)) {
      this.features[feature] = enabled;
      console.log(`[MsdDebugRenderer] Feature '${feature}' ${enabled ? 'enabled' : 'disabled'}`);

      // Re-render if debug layer exists
      if (this.debugLayer) {
        // Trigger a re-render through the debug system
        setTimeout(() => {
          if (window.__msdDebug?.debug?.render) {
            console.log(`[MsdDebugRenderer] Re-rendering after feature toggle: ${feature}`);
          }
        }, 10);
      }
    }
  }

  /**
   * Get current debug state
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
}

// Keep browser fallback for direct script loading
if (typeof window !== 'undefined') {
  window.cblcars = window.cblcars || {};
  window.cblcars.MsdDebugRenderer = MsdDebugRenderer;
}