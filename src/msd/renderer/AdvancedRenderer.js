import { perfTime, perfTimeAsync, perfCount } from '../util/performance.js';
import { computeObjectHash } from '../util/hashing.js';

/**
 * Advanced renderer with intelligent diffing for minimal DOM updates
 * Consumes ResolvedModel and maintains 60fps performance with 100+ overlays
 */
export class AdvancedRenderer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      enableDiffing: true,
      enableCaching: true,
      targetFps: 60,
      maxOverlays: 500,
      ...options
    };

    // State tracking
    this.lastModel = null;
    this.overlayElements = new Map(); // overlayId -> DOM element
    this.overlayHashes = new Map(); // overlayId -> style hash
    this.animationInstances = new Map(); // overlayId -> animation instance
    this.routingPaths = new Map(); // route key -> SVG path element

    // Performance tracking
    this.perfStats = {
      renders: 0,
      diffs: 0,
      domUpdates: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastRenderTime: 0,
      avgRenderTime: 0
    };

    // Initialize container
    this.initializeContainer();
  }

  /**
   * Initialize the SVG container structure
   */
  initializeContainer() {
    // Clear container
    this.container.innerHTML = '';

    // Create SVG structure
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'lcars-msd-renderer');

    // Create layered groups
    this.routingGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.routingGroup.setAttribute('class', 'routing-layer');

    this.overlaysGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.overlaysGroup.setAttribute('class', 'overlays-layer');

    this.animationsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.animationsGroup.setAttribute('class', 'animations-layer');

    // Add groups in rendering order
    this.svg.appendChild(this.routingGroup);
    this.svg.appendChild(this.overlaysGroup);
    this.svg.appendChild(this.animationsGroup);

    this.container.appendChild(this.svg);
  }

  /**
   * Render a resolved model with intelligent diffing
   */
  async render(resolvedModel) {
    return await perfTimeAsync('render.total', async () => {
      const startTime = performance.now();

      try {
        // Compute diff against previous model
        const diff = this.options.enableDiffing ?
          this.diffResolvedModels(this.lastModel, resolvedModel) :
          this.fullRenderDiff(resolvedModel);

        // Apply updates based on diff
        await this.applyModelDiff(diff, resolvedModel);

        // Update state
        this.lastModel = this.cloneModel(resolvedModel);

        // Performance tracking
        const renderTime = performance.now() - startTime;
        this.updatePerformanceStats(renderTime);

        perfCount('render.frames', 1);

        return {
          rendered: true,
          renderTime,
          diff: {
            overlaysChanged: diff.overlays.modified.length + diff.overlays.added.length,
            routesChanged: diff.routing.modified.length + diff.routing.added.length,
            viewBoxChanged: diff.viewBox.changed
          }
        };

      } catch (error) {
        console.error('[AdvancedRenderer] Render failed:', error);
        perfCount('render.errors', 1);
        throw error;
      }
    });
  }

  /**
   * Diff two resolved models for minimal updates
   */
  diffResolvedModels(current, desired) {
    return perfTime('render.diff', () => {
      const diff = {
        viewBox: this.diffViewBox(current?.view_box, desired?.view_box),
        overlays: this.diffOverlays(current?.overlays || [], desired?.overlays || []),
        routing: this.diffRouting(current?.routing_paths || [], desired?.routing_paths || []),
        animations: this.diffAnimations(current?.animations || [], desired?.animations || [])
      };

      this.perfStats.diffs++;
      perfCount('render.diffs', 1);

      return diff;
    });
  }

  /**
   * Diff view box changes
   */
  diffViewBox(current, desired) {
    const currentStr = current ? current.join(',') : '';
    const desiredStr = desired ? desired.join(',') : '';

    return {
      changed: currentStr !== desiredStr,
      from: current,
      to: desired
    };
  }

  /**
   * Diff overlay changes
   */
  diffOverlays(current, desired) {
    const diff = {
      added: [],
      removed: [],
      modified: [],
      unchanged: []
    };

    const currentIds = new Set(current.map(o => o.id));
    const desiredIds = new Set(desired.map(o => o.id));

    // Find added overlays
    desired.forEach(overlay => {
      if (!currentIds.has(overlay.id)) {
        diff.added.push(overlay);
      }
    });

    // Find removed overlays
    current.forEach(overlay => {
      if (!desiredIds.has(overlay.id)) {
        diff.removed.push(overlay);
      }
    });

    // Find modified/unchanged overlays
    desired.forEach(desiredOverlay => {
      if (currentIds.has(desiredOverlay.id)) {
        const currentOverlay = current.find(o => o.id === desiredOverlay.id);

        if (this.overlayChanged(currentOverlay, desiredOverlay)) {
          diff.modified.push({
            id: desiredOverlay.id,
            current: currentOverlay,
            desired: desiredOverlay,
            changes: this.computeOverlayChanges(currentOverlay, desiredOverlay)
          });
        } else {
          diff.unchanged.push(desiredOverlay);
        }
      }
    });

    return diff;
  }

  /**
   * Check if overlay has changed
   */
  overlayChanged(current, desired) {
    // Quick hash comparison for style changes
    const currentHash = this.computeOverlayHash(current);
    const desiredHash = this.computeOverlayHash(desired);

    if (currentHash !== desiredHash) {
      return true;
    }

    // Check position changes
    if (JSON.stringify(current.position) !== JSON.stringify(desired.position)) {
      return true;
    }

    // Check size changes
    if (JSON.stringify(current.size) !== JSON.stringify(desired.size)) {
      return true;
    }

    return false;
  }

  /**
   * Compute overlay changes for targeted updates
   */
  computeOverlayChanges(current, desired) {
    const changes = {
      position: false,
      size: false,
      style: {},
      animation: false
    };

    // Position changes
    if (JSON.stringify(current.position) !== JSON.stringify(desired.position)) {
      changes.position = true;
    }

    // Size changes
    if (JSON.stringify(current.size) !== JSON.stringify(desired.size)) {
      changes.size = true;
    }

    // Style changes (property-level)
    const currentStyle = current.style || {};
    const desiredStyle = desired.style || {};

    const allStyleProps = new Set([
      ...Object.keys(currentStyle),
      ...Object.keys(desiredStyle)
    ]);

    allStyleProps.forEach(prop => {
      if (currentStyle[prop] !== desiredStyle[prop]) {
        changes.style[prop] = {
          from: currentStyle[prop],
          to: desiredStyle[prop]
        };
      }
    });

    // Animation changes
    if (current.animation_hash !== desired.animation_hash) {
      changes.animation = true;
    }

    return changes;
  }

  /**
   * Diff routing path changes
   */
  diffRouting(current, desired) {
    const diff = {
      added: [],
      removed: [],
      modified: [],
      unchanged: []
    };

    const currentPaths = new Map(current.map(r => [r.id, r]));
    const desiredPaths = new Map(desired.map(r => [r.id, r]));

    // Find changes
    desired.forEach(route => {
      if (!currentPaths.has(route.id)) {
        diff.added.push(route);
      } else {
        const currentRoute = currentPaths.get(route.id);
        if (route.path_d !== currentRoute.path_d || route.style_hash !== currentRoute.style_hash) {
          diff.modified.push({
            id: route.id,
            current: currentRoute,
            desired: route
          });
        } else {
          diff.unchanged.push(route);
        }
      }
    });

    current.forEach(route => {
      if (!desiredPaths.has(route.id)) {
        diff.removed.push(route);
      }
    });

    return diff;
  }

  /**
   * Diff animation changes
   */
  diffAnimations(current, desired) {
    // Animation diffing - check for timeline and instance changes
    return {
      added: desired.filter(d => !current.some(c => c.id === d.id)),
      removed: current.filter(c => !desired.some(d => d.id === c.id)),
      modified: desired.filter(d => {
        const currentAnim = current.find(c => c.id === d.id);
        return currentAnim && (currentAnim.instance_hash !== d.instance_hash);
      }).map(d => ({
        current: current.find(c => c.id === d.id),
        desired: d
      }))
    };
  }

  /**
   * Apply model diff to DOM
   */
  async applyModelDiff(diff, resolvedModel) {
    return await perfTimeAsync('render.apply', async () => {
      // Update view box
      if (diff.viewBox.changed) {
        this.updateViewBox(diff.viewBox.to);
      }

      // Update overlays
      await this.updateOverlays(diff.overlays);

      // Update routing paths
      this.updateRoutingPaths(diff.routing);

      // Update animations
      await this.updateAnimations(diff.animations);

      perfCount('render.dom.updates', 1);
      this.perfStats.domUpdates++;
    });
  }

  /**
   * Update SVG view box
   */
  updateViewBox(viewBox) {
    if (viewBox && Array.isArray(viewBox) && viewBox.length === 4) {
      this.svg.setAttribute('viewBox', viewBox.join(' '));
      this.svg.setAttribute('width', viewBox[2]);
      this.svg.setAttribute('height', viewBox[3]);
    }
  }

  /**
   * Update overlay elements
   */
  async updateOverlays(overlayDiff) {
    // Remove overlays
    overlayDiff.removed.forEach(overlay => {
      const element = this.overlayElements.get(overlay.id);
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
      this.overlayElements.delete(overlay.id);
      this.overlayHashes.delete(overlay.id);
      perfCount('render.overlays.removed', 1);
    });

    // Add new overlays
    for (const overlay of overlayDiff.added) {
      const element = await this.createOverlayElement(overlay);
      if (element) {
        this.overlaysGroup.appendChild(element);
        this.overlayElements.set(overlay.id, element);
        this.overlayHashes.set(overlay.id, this.computeOverlayHash(overlay));
        perfCount('render.overlays.added', 1);
      }
    }

    // Update modified overlays
    for (const modification of overlayDiff.modified) {
      await this.updateOverlayElement(modification);
      perfCount('render.overlays.modified', 1);
    }
  }

  /**
   * Create DOM element for overlay
   */
  async createOverlayElement(overlay) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    element.setAttribute('id', `overlay-${overlay.id}`);
    element.setAttribute('class', `overlay overlay-${overlay.type}`);

    // Create type-specific content
    const content = await this.createOverlayContent(overlay);
    if (content) {
      element.appendChild(content);
    }

    // Apply positioning
    this.applyOverlayPosition(element, overlay);

    // Apply styling
    this.applyOverlayStyle(element, overlay);

    return element;
  }

  /**
   * Create type-specific overlay content
   */
  async createOverlayContent(overlay) {
    switch (overlay.type) {
      case 'text':
        return this.createTextContent(overlay);
      case 'line':
        return this.createLineContent(overlay);
      case 'sparkline':
        return this.createSparklineContent(overlay);
      case 'circle':
        return this.createCircleContent(overlay);
      case 'rect':
        return this.createRectContent(overlay);
      default:
        console.warn(`[AdvancedRenderer] Unknown overlay type: ${overlay.type}`);
        return null;
    }
  }

  /**
   * Create text content element
   */
  createTextContent(overlay) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = overlay.style?.value || '';
    return text;
  }

  /**
   * Create line content element
   */
  createLineContent(overlay) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');

    // Set coordinates from routing or direct coordinates
    if (overlay.route_path_d) {
      // Use path instead of line for routed lines
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', overlay.route_path_d);
      return path;
    } else {
      // Direct line coordinates
      const start = overlay.position || [0, 0];
      const end = overlay.attach_to_position || overlay.end_position || [start[0] + 100, start[1]];

      line.setAttribute('x1', start[0]);
      line.setAttribute('y1', start[1]);
      line.setAttribute('x2', end[0]);
      line.setAttribute('y2', end[1]);

      return line;
    }
  }

  /**
   * Create sparkline content element
   */
  createSparklineContent(overlay) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Create sparkline path from data
    if (overlay.data_points && Array.isArray(overlay.data_points)) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', this.generateSparklinePath(overlay.data_points, overlay.size));
      group.appendChild(path);
    }

    return group;
  }

  /**
   * Create circle content element
   */
  createCircleContent(overlay) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const size = overlay.size || [20, 20];
    const radius = Math.min(size[0], size[1]) / 2;

    circle.setAttribute('r', radius);
    circle.setAttribute('cx', radius);
    circle.setAttribute('cy', radius);

    return circle;
  }

  /**
   * Create rectangle content element
   */
  createRectContent(overlay) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const size = overlay.size || [100, 50];

    rect.setAttribute('width', size[0]);
    rect.setAttribute('height', size[1]);

    return rect;
  }

  /**
   * Apply overlay positioning
   */
  applyOverlayPosition(element, overlay) {
    if (overlay.position && Array.isArray(overlay.position)) {
      const transform = `translate(${overlay.position[0]}, ${overlay.position[1]})`;
      element.setAttribute('transform', transform);
    }
  }

  /**
   * Apply overlay styling
   */
  applyOverlayStyle(element, overlay) {
    const style = overlay.style || {};

    // Convert style object to SVG attributes
    Object.entries(style).forEach(([prop, value]) => {
      if (value !== undefined && value !== null) {
        const svgAttr = this.cssToSvgAttribute(prop);
        if (svgAttr) {
          element.setAttribute(svgAttr, value);
        }
      }
    });
  }

  /**
   * Convert CSS property to SVG attribute
   */
  cssToSvgAttribute(cssProperty) {
    const mapping = {
      'color': 'fill',
      'stroke-color': 'stroke',
      'width': 'stroke-width',
      'opacity': 'opacity',
      'font-size': 'font-size',
      'font-family': 'font-family'
    };

    return mapping[cssProperty] || cssProperty;
  }

  /**
   * Update existing overlay element
   */
  async updateOverlayElement(modification) {
    const element = this.overlayElements.get(modification.id);
    if (!element) return;

    const { changes, desired } = modification;

    // Update position if changed
    if (changes.position) {
      this.applyOverlayPosition(element, desired);
    }

    // Update individual style properties
    Object.entries(changes.style || {}).forEach(([prop, change]) => {
      const svgAttr = this.cssToSvgAttribute(prop);
      if (svgAttr && change.to !== undefined) {
        element.setAttribute(svgAttr, change.to);
      }
    });

    // Update content if needed (for text overlays)
    if (desired.type === 'text' && changes.style.value) {
      const textElement = element.querySelector('text');
      if (textElement) {
        textElement.textContent = desired.style.value;
      }
    }

    // Update hash
    this.overlayHashes.set(modification.id, this.computeOverlayHash(desired));
  }

  /**
   * Update routing paths
   */
  updateRoutingPaths(routingDiff) {
    // Remove routing paths
    routingDiff.removed.forEach(route => {
      const element = this.routingPaths.get(route.id);
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
      this.routingPaths.delete(route.id);
    });

    // Add new routing paths
    routingDiff.added.forEach(route => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('id', `route-${route.id}`);
      path.setAttribute('d', route.path_d);
      path.setAttribute('class', 'routing-path');

      // Apply route styling
      if (route.style) {
        Object.entries(route.style).forEach(([prop, value]) => {
          const svgAttr = this.cssToSvgAttribute(prop);
          if (svgAttr) {
            path.setAttribute(svgAttr, value);
          }
        });
      }

      this.routingGroup.appendChild(path);
      this.routingPaths.set(route.id, path);
    });

    // Update modified routing paths
    routingDiff.modified.forEach(modification => {
      const element = this.routingPaths.get(modification.id);
      if (element) {
        element.setAttribute('d', modification.desired.path_d);

        // Update styling if changed
        if (modification.desired.style) {
          Object.entries(modification.desired.style).forEach(([prop, value]) => {
            const svgAttr = this.cssToSvgAttribute(prop);
            if (svgAttr) {
              element.setAttribute(svgAttr, value);
            }
          });
        }
      }
    });
  }

  /**
   * Update animations
   */
  async updateAnimations(animationDiff) {
    // Handle animation updates - integrate with animation registry
    animationDiff.removed.forEach(anim => {
      const instance = this.animationInstances.get(anim.id);
      if (instance && instance.stop) {
        instance.stop();
      }
      this.animationInstances.delete(anim.id);
    });

    // Add/update animations would integrate with the global animation registry
    // This is a placeholder for animation system integration
  }

  /**
   * Generate diff for full render (no previous model)
   */
  fullRenderDiff(resolvedModel) {
    return {
      viewBox: {
        changed: true,
        from: null,
        to: resolvedModel.view_box
      },
      overlays: {
        added: resolvedModel.overlays || [],
        removed: [],
        modified: [],
        unchanged: []
      },
      routing: {
        added: resolvedModel.routing_paths || [],
        removed: [],
        modified: [],
        unchanged: []
      },
      animations: {
        added: resolvedModel.animations || [],
        removed: [],
        modified: []
      }
    };
  }

  /**
   * Compute hash for overlay to detect changes
   */
  computeOverlayHash(overlay) {
    const hashData = {
      type: overlay.type,
      position: overlay.position,
      size: overlay.size,
      style: overlay.style,
      route_path_d: overlay.route_path_d
    };

    return computeObjectHash(hashData);
  }

  /**
   * Clone model for state tracking
   */
  cloneModel(model) {
    return JSON.parse(JSON.stringify(model));
  }

  /**
   * Update performance statistics
   */
  updatePerformanceStats(renderTime) {
    this.perfStats.renders++;
    this.perfStats.lastRenderTime = renderTime;
    this.perfStats.avgRenderTime = this.perfStats.avgRenderTime +
      (renderTime - this.perfStats.avgRenderTime) / this.perfStats.renders;
  }

  /**
   * Generate sparkline path from data points
   */
  generateSparklinePath(dataPoints, size = [100, 50]) {
    if (!dataPoints.length) return '';

    const [width, height] = size;
    const xStep = width / (dataPoints.length - 1);

    // Find min/max for scaling
    const values = dataPoints.map(p => p.value || p);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    let path = '';

    dataPoints.forEach((point, index) => {
      const value = point.value || point;
      const x = index * xStep;
      const y = range > 0 ? height - ((value - min) / range * height) : height / 2;

      if (index === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }
    });

    return path;
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      ...this.perfStats,
      overlayCount: this.overlayElements.size,
      routingPathCount: this.routingPaths.size,
      animationCount: this.animationInstances.size,
      avgFps: this.perfStats.avgRenderTime > 0 ? 1000 / this.perfStats.avgRenderTime : 0
    };
  }

  /**
   * Clear all rendered content
   */
  clear() {
    this.overlayElements.clear();
    this.overlayHashes.clear();
    this.routingPaths.clear();
    this.animationInstances.clear();
    this.lastModel = null;

    this.routingGroup.innerHTML = '';
    this.overlaysGroup.innerHTML = '';
    this.animationsGroup.innerHTML = '';

    perfCount('render.cleared', 1);
  }

  /**
   * Export renderer statistics
   */
  exportStats(options = {}) {
    const stats = this.getStats();

    return options.format === 'json' ?
      JSON.stringify(stats, null, 2) :
      stats;
  }
}

// Debug exposure
const debugNamespace = (typeof window !== 'undefined') ? window : global;
if (debugNamespace) {
  debugNamespace.__msdRenderer = {
    getStats: null, // Will be set by renderer instance
    clear: null,
    exportStats: null
  };
}
