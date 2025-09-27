import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * [MsdDebugRenderer] Debug visualization renderer - shows anchor markers, overlay bounding boxes, routing guidelines
 * 🔍 Provides comprehensive debug overlays with performance metrics and visual debugging aids
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
  }

  /**
   * Initialize with systems manager and subscribe to debug changes
   * @param {SystemsManager} systemsManager - Systems manager instance
   */
  init(systemsManager) {
    this.debugManager = systemsManager.debugManager;

    // Subscribe to debug state changes for reactive rendering
    this.unsubscribeDebug = this.debugManager.onChange((event) => {
      // REDUCED: Only log significant events
      if (event.type === 'feature' || event.type === 'scale' || event.type === 'router-ready') {
        this._scheduleRerender();
      }
    });

  }

  /**
   * Set scale factor from debug configuration
   * @param {number} scale - Scale multiplier (default 1.0)
   */
  setScale(scale = 1.0) {
    this.scale = Math.max(0.3, Math.min(3.0, scale)); // Clamp between reasonable bounds
    cblcarsLog.debug(`[MsdDebugRenderer] 🔍 Scale factor set to: ${this.scale}`);
  }

  /**
   * Main render method - now powered by DebugManager state
   * @param {Element} root - DOM root element
   * @param {Array} viewBox - SVG viewBox [x, y, width, height]
   * @param {Object} opts - Render options
   */
  render(root, viewBox, opts = {}) {
    // REDUCED: Only log if debug is actually enabled
    const debugState = this.debugManager?.getSnapshot();
    if (!debugState?.enabled) {
      return;
    }

    // Store context for reactive re-renders
    this._lastRenderContext = { root, viewBox, opts };

    if (!this.debugManager || !this.debugManager.initialized) {
      return;
    }

    if (!root || typeof root.querySelector !== 'function') {
      cblcarsLog.warn('[MsdDebugRenderer] Invalid root element');
      return;
    }

    const svgElement = root.querySelector('svg');
    if (!svgElement) {
      cblcarsLog.warn('[MsdDebugRenderer] No SVG element found in root');
      return;
    }

    // Update scale from DebugManager
    this.setScale(debugState.scale);

    // Setup debug layer
    this.integrateWithAdvancedRenderer(svgElement, viewBox, opts.anchors);

    // Clear existing debug content
    if (this.debugLayer) {
      this.debugLayer.innerHTML = '';
    }

    // Exit early if no features enabled
    if (!debugState.enabled) {
      if (this.debugLayer) {
        this.debugLayer.style.display = 'none';
      }
      return;
    }

    // REDUCED: Only log when actually rendering features
    cblcarsLog.debug('[MsdDebugRenderer] 🔍 Rendering debug features', debugState);

    // Render enabled features using DebugManager state
    if (debugState.anchors && opts.anchors) {
      this.renderAnchorMarkers(opts.anchors);
    }

    if (debugState.bounding_boxes && opts.overlays) {
      this.renderOverlayBounds(opts.overlays);
    }

    if (debugState.routing && this.debugManager.canRenderRouting()) {
      this.renderRoutingGuides(opts);
    }

    if (debugState.performance) {
      this.renderPerformanceOverlays(opts);
    }

    // Show debug layer
    if (this.debugLayer) {
      this.debugLayer.style.display = 'block';
    }
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
      cblcarsLog.debug('[MsdDebugRenderer] Routing system not available for debug rendering');
      return;
    }

    const overlays = opts.overlays || [];
    const lineOverlays = overlays.filter(o => o.type === 'line');

    if (lineOverlays.length === 0) {
      cblcarsLog.debug('[MsdDebugRenderer] No line overlays found for routing visualization');
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
          cblcarsLog.debug(`[MsdDebugRenderer] No route info for overlay ${overlay.id}`);
        }
      } catch (error) {
        cblcarsLog.warn(`[MsdDebugRenderer] ⚠️ Failed to render routing guide for ${overlay.id}:`, error);
      }
    });

    if (routeCount > 0) {
      cblcarsLog.debug(`[MsdDebugRenderer] Rendered ${routeCount} routing guides`);
    }
  }

  /**
   * Create routing visualization overlay group.
   * @param {string} overlayId
   * @param {Object} routeInfo
   * @returns {SVGGElement}
   */
  createRoutingOverlay(overlayId, routeInfo) {
    const doc = this.debugLayer.ownerDocument;
    const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'msd-debug-routing');

    const points = routeInfo.pts || [];
    points.forEach((pt, index) => {
      if (Array.isArray(pt) && pt.length >= 2) {
        const [x, y] = pt;
        const waypoint = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
        waypoint.setAttribute('cx', x);
        waypoint.setAttribute('cy', y);
        waypoint.setAttribute('r', 2 * this.scale);
        waypoint.setAttribute('fill', 'magenta');
        waypoint.setAttribute('stroke', 'white');
        waypoint.setAttribute('stroke-width', 1 * this.scale);
        waypoint.setAttribute('opacity', '0.8');
        group.appendChild(waypoint);

        if (index === 0 || index === points.length - 1 || points.length <= 6) {
          const label = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
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
        const info = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
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

    cblcarsLog.debug(`[MsdDebugRenderer] Rendered ${markerCount} anchor markers`);
  }

  /**
   * Create individual anchor marker group element
   * @param {string} name
   * @param {number} x
   * @param {number} y
   * @returns {SVGGElement}
   */
  createAnchorMarker(name, x, y) {
    const group = this.debugLayer.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g');
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

        // Get actual dimensions based on overlay type
        const dimensions = this._getOverlayDimensions(overlay, x, y);
        if (!dimensions) return;

        const bboxObj = this.createBoundingBox(overlay.id, dimensions.x, dimensions.y, dimensions.width, dimensions.height);
        this.debugLayer.appendChild(bboxObj.rect);
        this.debugLayer.appendChild(bboxObj.label);
        this.boundingBoxes.set(overlay.id, bboxObj);
        bboxCount++;
      }
    });

    cblcarsLog.debug(`[MsdDebugRenderer] Rendered ${bboxCount} bounding boxes`);
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
    const doc = this.debugLayer.ownerDocument;
    const rect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
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

    const label = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
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
      cblcarsLog.debug('[MsdDebugRenderer] No performance data available');
      return;
    }

    const doc = this.debugLayer.ownerDocument;
    const perfGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    perfGroup.setAttribute('class', 'msd-debug-performance');

    const baseX = 10 * this.scale;
    const baseY = 10 * this.scale;
    const width = 200 * this.scale;
    const padding = 5 * this.scale;

    const bg = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', baseX);
    bg.setAttribute('y', baseY);
    bg.setAttribute('width', width);
    bg.setAttribute('height', (20 + perfEntries.slice(0, 8).length * 15) * this.scale);
    bg.setAttribute('fill', 'rgba(0,0,0,0.8)');
    bg.setAttribute('stroke', 'yellow');
    bg.setAttribute('stroke-width', 1 * this.scale);
    bg.setAttribute('rx', 4 * this.scale);
    perfGroup.appendChild(bg);

    const title = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', baseX + padding);
    title.setAttribute('y', baseY + (15 * this.scale));
    title.setAttribute('fill', 'yellow');
    title.setAttribute('font-size', 12 * this.scale);
    title.setAttribute('font-family', 'monospace');
    title.setAttribute('font-weight', 'bold');
    title.textContent = 'Performance';
    perfGroup.appendChild(title);

    perfEntries.slice(0, 8).forEach((entryText, index) => {
      const entry = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
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

    cblcarsLog.debug(`[MsdDebugRenderer] Rendered performance overlay with ${perfEntries.length} metrics at scale ${this.scale}`);
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
      cblcarsLog.warn('[MsdDebugRenderer] ensureDebugLayer: no SVG element provided');
      return;
    }

    let debugLayer = svgElement.querySelector('#msd-debug-layer');
    if (!debugLayer) {
      cblcarsLog.debug('[MsdDebugRenderer] Creating new debug layer');
      const doc = svgElement.ownerDocument;
      debugLayer = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
      debugLayer.id = 'msd-debug-layer';
      debugLayer.style.pointerEvents = 'none';
      debugLayer.style.zIndex = '1000';
      svgElement.appendChild(debugLayer);
    } else {
      cblcarsLog.debug('[MsdDebugRenderer] Using existing debug layer');
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
    cblcarsLog.debug(`[MsdDebugRenderer] Debug visualization ${enabled ? 'enabled' : 'disabled'}`);
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
      cblcarsLog.debug(`[MsdDebugRenderer] Feature '${feature}' ${enabled ? 'enabled' : 'disabled'}`);

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
   * Get overlay dimensions based on overlay type and rendered content - ENHANCED for baseline accuracy
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {Object|null} Dimensions object with x, y, width, height
   */
  _getOverlayDimensions(overlay, x, y) {
    // First, check if the overlay has been rendered and has dimension data attributes
    if (this.debugLayer) {
      const svgElement = this.debugLayer.closest('svg');
      if (svgElement) {
        const renderedOverlay = svgElement.querySelector(`[data-overlay-id="${overlay.id}"]`);
        if (renderedOverlay) {
          // Try to get dimensions from data attributes (set by TextOverlayRenderer)
          const width = renderedOverlay.getAttribute('data-text-width');
          const height = renderedOverlay.getAttribute('data-text-height');
          const fontSize = renderedOverlay.getAttribute('data-font-size');
          const dominantBaseline = renderedOverlay.getAttribute('data-dominant-baseline');
          const textAnchor = renderedOverlay.getAttribute('data-text-anchor');

          if (width && height && width !== '0' && height !== '0') {
            // Calculate proper positions based on actual rendered attributes
            const textHeight = parseFloat(height);
            const textWidth = parseFloat(width);
            const textFontSize = parseFloat(fontSize) || 16;

            // Y position calculation based on actual dominant baseline
            let adjustedY = y;
            const actualBaseline = dominantBaseline || 'auto';

            if (actualBaseline === 'hanging') {
              // Text starts at y, so bounding box starts at y
              adjustedY = y;
            } else if (actualBaseline === 'middle' || actualBaseline === 'central') {
              // Text is centered on y, so bounding box starts at y - height/2
              adjustedY = y - textHeight / 2;
            } else if (actualBaseline === 'text-after-edge') {
              // Text ends at y, so bounding box starts at y - height
              adjustedY = y - textHeight;
            } else {
              // Default/auto baseline - estimate ascent position
              const ascent = textFontSize * 0.7;
              adjustedY = y - ascent;
            }

            // X position calculation based on actual text anchor
            let adjustedX = x;
            const actualTextAnchor = textAnchor || 'start';

            if (actualTextAnchor === 'middle') {
              adjustedX = x - textWidth / 2;
            } else if (actualTextAnchor === 'end') {
              adjustedX = x - textWidth;
            }
            // 'start' anchor keeps x as-is



            return {
              x: adjustedX,
              y: adjustedY,
              width: textWidth,
              height: textHeight
            };
          }
        }
      }
    }

    // Fallback to overlay-specific dimension calculation
    switch (overlay.type) {
      case 'text':
        return this._calculateTextOverlayDimensions(overlay, x, y);

      case 'line':
        return this._calculateLineOverlayDimensions(overlay, x, y);

      case 'image':
        return this._calculateImageOverlayDimensions(overlay, x, y);

      case 'rect':
      case 'rectangle':
        return this._calculateRectOverlayDimensions(overlay, x, y);

      default:
        // Generic fallback using size property or default
        const width = overlay.size ? overlay.size[0] : 100;
        const height = overlay.size ? overlay.size[1] : 20;
        return { x, y, width, height };
    }
  }

  /**
   * Calculate text overlay dimensions using similar logic to TextOverlayRenderer
   * @private
   */
  _calculateTextOverlayDimensions(overlay, x, y) {
    try {
      // Get the SVG container for proper measurement context
      const svgElement = this.debugLayer?.closest('svg');
      const container = svgElement?.parentElement || this.debugLayer;

      // Try to use TextOverlayRenderer's attachment point calculation
      if (window.cblcars?.TextOverlayRenderer?.computeAttachmentPoints) {
        const attachmentData = window.cblcars.TextOverlayRenderer.computeAttachmentPoints(
          overlay,
          this.anchors || {},
          container
        );

        if (attachmentData && attachmentData.bbox) {
          cblcarsLog.debug(`[MsdDebugRenderer] Using TextOverlayRenderer bbox for ${overlay.id}`);
          return {
            x: attachmentData.bbox.left,
            y: attachmentData.bbox.top,
            width: attachmentData.bbox.width,
            height: attachmentData.bbox.height
          };
        }
      }

      // Alternative: Try to get dimensions from already rendered overlay
      if (svgElement) {
        const renderedElement = svgElement.querySelector(`[data-overlay-id="${overlay.id}"]`);
        if (renderedElement) {
          try {
            const bbox = renderedElement.getBBox();
            if (bbox.width > 0 && bbox.height > 0) {
              cblcarsLog.debug(`[MsdDebugRenderer] Using getBBox for ${overlay.id}: ${bbox.width}x${bbox.height}`);
              return {
                x: bbox.x,
                y: bbox.y,
                width: bbox.width,
                height: bbox.height
              };
            }
          } catch (bboxError) {
            cblcarsLog.warn(`[MsdDebugRenderer] getBBox failed for ${overlay.id}:`, bboxError);
          }
        }
      }

      // Fallback to manual text measurement
      const style = overlay.finalStyle || overlay.style || {};
      const textContent = style.value || overlay.text || overlay.content ||
                         overlay._raw?.content || overlay._raw?.text || '';

      if (!textContent) {
        return { x, y, width: 0, height: 0 };
      }

      // Basic text measurement fallback
      const fontSize = style.font_size || style.fontSize || 16;
      const fontFamily = style.font_family || style.fontFamily || 'monospace';

      // Estimate dimensions (this is a rough approximation)
      const charWidth = fontSize * 0.6; // Rough estimate for monospace
      const lineHeight = fontSize * 1.2;

      const lines = textContent.split('\n');
      const maxLineLength = Math.max(...lines.map(line => line.length));

      const width = maxLineLength * charWidth;
      const height = lines.length * lineHeight;

      // Adjust position based on text anchor and baseline
      const textAnchor = style.text_anchor || style.textAnchor || 'start';
      const dominantBaseline = style.dominant_baseline || style.dominantBaseline || 'auto';

      let adjustedX = x;
      if (textAnchor === 'middle') {
        adjustedX = x - width / 2;
      } else if (textAnchor === 'end') {
        adjustedX = x - width;
      }

      // Calculate proper Y position based on dominant baseline
      let adjustedY = y;
      const ascent = fontSize * 0.7; // Estimate ascent

      if (dominantBaseline === 'hanging') {
        // Text starts at y, so bounding box starts at y
        adjustedY = y;
      } else if (dominantBaseline === 'middle' || dominantBaseline === 'central') {
        // Text is centered on y, so bounding box starts at y - height/2
        adjustedY = y - height / 2;
      } else if (dominantBaseline === 'text-after-edge') {
        // Text ends at y, so bounding box starts at y - height
        adjustedY = y - height;
      } else {
        // Default/auto baseline - text baseline is at y, so bounding box starts at y - ascent
        adjustedY = y - ascent;
      }

      return {
        x: adjustedX,
        y: adjustedY,
        width,
        height
      };
    } catch (error) {
      cblcarsLog.warn(`[MsdDebugRenderer] ⚠️ Failed to calculate text dimensions for ${overlay.id}:`, error);
      return { x, y, width: 100, height: 20 };
    }
  }

  /**
   * Calculate line overlay dimensions
   * @private
   */
  _calculateLineOverlayDimensions(overlay, x, y) {
    const endpoints = overlay.endpoints || overlay.end_points;
    if (!endpoints || !Array.isArray(endpoints) || endpoints.length < 2) {
      return { x, y, width: 50, height: 2 };
    }

    const [start, end] = endpoints;
    const startX = Array.isArray(start) ? start[0] : start.x || x;
    const startY = Array.isArray(start) ? start[1] : start.y || y;
    const endX = Array.isArray(end) ? end[0] : end.x || x + 50;
    const endY = Array.isArray(end) ? end[1] : end.y || y;

    const minX = Math.min(startX, endX);
    const minY = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    return {
      x: minX,
      y: minY,
      width: Math.max(width, 2), // Minimum width for visibility
      height: Math.max(height, 2) // Minimum height for visibility
    };
  }

  /**
   * Calculate image overlay dimensions
   * @private
   */
  _calculateImageOverlayDimensions(overlay, x, y) {
    const style = overlay.finalStyle || overlay.style || {};
    const width = style.width || overlay.width || overlay.size?.[0] || 64;
    const height = style.height || overlay.height || overlay.size?.[1] || 64;

    return { x, y, width: parseFloat(width), height: parseFloat(height) };
  }

  /**
   * Calculate rectangle overlay dimensions
   * @private
   */
  _calculateRectOverlayDimensions(overlay, x, y) {
    const style = overlay.finalStyle || overlay.style || {};
    const width = style.width || overlay.width || overlay.size?.[0] || 100;
    const height = style.height || overlay.height || overlay.size?.[1] || 50;

    return { x, y, width: parseFloat(width), height: parseFloat(height) };
  }

  /**
   * Essential cleanup to prevent memory leaks
   */
  destroy() {
    // Unsubscribe from debug manager changes
    if (this.unsubscribeDebug) {
      this.unsubscribeDebug();
      this.unsubscribeDebug = null;
    }

    // Clear debug layer reference
    this.debugLayer = null;
    this._lastRenderContext = null;
  }
}

// Keep browser fallback for direct script loading
if (typeof window !== 'undefined') {
  window.cblcars = window.cblcars || {};
  window.cblcars.MsdDebugRenderer = MsdDebugRenderer;
}