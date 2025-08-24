/**
 * Phase 2: Debug visualization renderer
 * Shows anchor markers, overlay bounding boxes, connector guidelines
 */

export class MsdDebugRenderer {
  constructor() {
    this.enabled = false;
    this.debugLayer = null;
    this.anchorMarkers = new Map();
    this.boundingBoxes = new Map();
  }

  render(resolvedModel, debugFlags) {
    if (!this.shouldRender(debugFlags)) return;

    // FIXED: Find the SVG element in the DOM
    const svgElement = this.findSvgElement();
    if (!svgElement) {
      console.warn('[MsdDebugRenderer] No SVG element found in DOM');
      return;
    }

    this.ensureDebugLayer(svgElement);
    this.debugLayer.innerHTML = '';

    if (debugFlags.overlay) {
      this.renderAnchorMarkers(resolvedModel.anchors);
      this.renderOverlayBoundingBoxes(resolvedModel.overlays);
    }

    if (debugFlags.connectors) {
      this.renderConnectorGuidelines(resolvedModel.overlays);
    }

    console.log('[MsdDebugRenderer] Debug visualization rendered successfully');
  }

  // ADDED: Helper to find SVG in DOM
  findSvgElement() {
    // Look for common SVG containers
    const selectors = [
      'svg',
      '#msd-v1-comprehensive-wrapper svg',
      '[id*="msd"] svg',
      '.msd svg'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log('[MsdDebugRenderer] Found SVG element via:', selector);
        return element;
      }
    }

    return null;
  }

  ensureDebugLayer(svgElement) {
    if (this.debugLayer && this.debugLayer.parentNode === svgElement) return;

    // Find or create debug layer in SVG
    let debugLayer = svgElement.querySelector('#msd-debug-layer');
    if (!debugLayer) {
      debugLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      debugLayer.setAttribute('id', 'msd-debug-layer');
      debugLayer.style.pointerEvents = 'none';
      svgElement.appendChild(debugLayer);
    }

    this.debugLayer = debugLayer;
  }

  renderAnchorMarkers(anchors) {
    if (!anchors || !this.debugLayer) return;

    let html = '';
    for (const [name, pt] of Object.entries(anchors)) {
      if (Array.isArray(pt) && pt.length >= 2) {
        // ENHANCED: Better anchor markers with crosshairs and labels
        html += `
          <g transform="translate(${pt[0]}, ${pt[1]})">
            <line x1="-8" y1="0" x2="8" y2="0" stroke="cyan" stroke-width="2"/>
            <line x1="0" y1="-8" x2="0" y2="8" stroke="cyan" stroke-width="2"/>
            <circle cx="0" cy="0" r="3" fill="cyan" stroke="white" stroke-width="1"/>
            <text x="12" y="4" fill="cyan" font-size="12" font-family="monospace">${name} (${Math.round(pt[0])}, ${Math.round(pt[1])})</text>
          </g>
        `;
      }
    }
    this.debugLayer.innerHTML += html;
    console.log(`[MsdDebugRenderer] Rendered ${Object.keys(anchors).length} anchor markers`);
  }

  renderOverlayBoundingBoxes(overlays) {
    if (!overlays || !this.debugLayer) return;

    let html = '';
    overlays.forEach(overlay => {
      if (overlay.position && Array.isArray(overlay.position)) {
        const [x, y] = overlay.position;
        const width = overlay.size ? overlay.size[0] : 100;
        const height = overlay.size ? overlay.size[1] : 20;

        html += `
          <rect x="${x}" y="${y}" width="${width}" height="${height}"
                fill="none" stroke="orange" stroke-width="1"
                stroke-dasharray="3,3" opacity="0.7"/>
          <text x="${x + 2}" y="${y + 12}" fill="orange" font-size="10"
                font-family="monospace">${overlay.id}</text>
        `;
      }
    });

    this.debugLayer.innerHTML += html;
    console.log(`[MsdDebugRenderer] Rendered ${overlays.length} overlay bounding boxes`);
  }

  renderConnectorGuidelines(overlays) {
    // Basic implementation - can be enhanced later
    console.log('[MsdDebugRenderer] Connector guidelines not fully implemented yet');
  }

  shouldRender(debugFlags) {
    return debugFlags && (debugFlags.overlay || debugFlags.connectors || debugFlags.geometry);
  }

  // Connect to AdvancedRenderer's SVG structure
  integrateWithAdvancedRenderer(svgElement, viewBox, anchors = {}) {
    if (!svgElement) return;

    // Find or create debug layer in SVG
    let debugLayer = svgElement.querySelector('#msd-debug-layer');
    if (!debugLayer) {
      debugLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      debugLayer.id = 'msd-debug-layer';
      debugLayer.style.pointerEvents = 'none';
      svgElement.appendChild(debugLayer);
    }

    this.debugLayer = debugLayer;
    this.viewBox = viewBox;
    this.anchors = anchors;

    if (this.enabled) {
      this.renderDebugMarkers();
    }
  }

  // Render anchor markers using existing anchor data
  renderDebugMarkers() {
    if (!this.debugLayer || !this.anchors) return;

    // Clear existing markers
    this.debugLayer.innerHTML = '';

    // Add anchor markers
    Object.entries(this.anchors).forEach(([name, [x, y]]) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      marker.setAttribute('transform', `translate(${x}, ${y})`);

      // Crosshair marker
      const crosshair = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      crosshair.innerHTML = `
        <line x1="-8" y1="0" x2="8" y2="0" stroke="cyan" stroke-width="2"/>
        <line x1="0" y1="-8" x2="0" y2="8" stroke="cyan" stroke-width="2"/>
        <circle cx="0" cy="0" r="3" fill="cyan" stroke="white" stroke-width="1"/>
      `;
      marker.appendChild(crosshair);

      // Label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', '12');
      label.setAttribute('y', '4');
      label.setAttribute('fill', 'cyan');
      label.setAttribute('font-size', '12');
      label.setAttribute('font-family', 'monospace');
      label.textContent = `${name} (${Math.round(x)}, ${Math.round(y)})`;
      marker.appendChild(label);

      this.debugLayer.appendChild(marker);
      this.anchorMarkers.set(name, marker);
    });

    console.log(`[MsdDebugRenderer] Rendered ${Object.keys(this.anchors).length} anchor markers`);
  }

  // Add bounding box visualization for overlays
  renderOverlayBounds(overlays = []) {
    if (!this.debugLayer) return;

    overlays.forEach(overlay => {
      if (!overlay.bounds) return;

      const { x, y, width, height } = overlay.bounds;
      const bbox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bbox.setAttribute('x', x);
      bbox.setAttribute('y', y);
      bbox.setAttribute('width', width);
      bbox.setAttribute('height', height);
      bbox.setAttribute('fill', 'none');
      bbox.setAttribute('stroke', 'orange');
      bbox.setAttribute('stroke-width', '1');
      bbox.setAttribute('stroke-dasharray', '3,3');
      bbox.setAttribute('opacity', '0.7');

      // Add label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x + 2);
      label.setAttribute('y', y + 12);
      label.setAttribute('fill', 'orange');
      label.setAttribute('font-size', '10');
      label.setAttribute('font-family', 'monospace');
      label.textContent = overlay.id || 'unknown';

      this.debugLayer.appendChild(bbox);
      this.debugLayer.appendChild(label);
      this.boundingBoxes.set(overlay.id, { bbox, label });
    });
  }

  // Toggle debug visualization
  toggle(enabled = !this.enabled) {
    this.enabled = enabled;

    if (this.debugLayer) {
      this.debugLayer.style.display = enabled ? 'block' : 'none';
    }

    if (enabled && this.anchors) {
      this.renderDebugMarkers();
    }

    console.log(`[MsdDebugRenderer] Debug visualization ${enabled ? 'enabled' : 'disabled'}`);
  }

  // FIXED: Integration method for window.__msdDebug with proper DOM element checking
  // UPDATED: Suppress warning when debug renderer is working correctly
  render(root, viewBox, opts = {}) {
    // Check if root is a valid DOM element with querySelector
    if (!root || typeof root.querySelector !== 'function') {
      // SUPPRESSED: Only warn if debug flags suggest this should work
      const shouldWarn = opts.debug || (typeof window !== 'undefined' && window.cblcars?._debugFlags?.verbose);

      if (shouldWarn) {
        console.warn('[MsdDebugRenderer] Invalid root element - missing querySelector method');
        console.warn('[MsdDebugRenderer] Root type:', typeof root, 'Root:', root);
      }
      return;
    }

    const svgElement = root.querySelector('svg');
    if (!svgElement) {
      console.warn('[MsdDebugRenderer] No SVG element found in root');
      return;
    }

    this.integrateWithAdvancedRenderer(svgElement, viewBox, opts.anchors);
    this.toggle(true);
  }
}

// Keep browser fallback for direct script loading
if (typeof window !== 'undefined') {
  window.cblcars = window.cblcars || {};
  window.cblcars.MsdDebugRenderer = MsdDebugRenderer;
}
