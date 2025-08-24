/**
 * Phase 1: Enhanced renderer with real-time data integration
 * Replaces basic RendererV1 with advanced features
 * Clean implementation focused on core functionality
 */

export class AdvancedRenderer {
  constructor(container, router) {
    this.container = container;
    this.router = router;
    this.overlayElements = new Map();
    this.lastRenderArgs = null;
    this.debugRenderer = null;
  }

  render(resolvedModel) {
    if (!resolvedModel) return { svgMarkup: '' };

    this.lastRenderArgs = resolvedModel;

    // Find or create overlay container
    const svg = this.container.querySelector('svg');
    if (!svg) {
      console.warn('[AdvancedRenderer] No SVG found in container');
      return { svgMarkup: '' };
    }

    // Clear existing overlays
    this.clearOverlays(svg);

    let svgMarkup = '';

    // Render all overlays
    for (const overlay of resolvedModel.overlays || []) {
      const markup = this.renderOverlay(overlay, resolvedModel);
      if (markup) {
        svgMarkup += markup;
      }
    }

    // Add to SVG
    if (svgMarkup) {
      svg.innerHTML += svgMarkup;
    }

    // Create debug layer integration if debug renderer exists
    if (this.debugRenderer && (resolvedModel.overlays || []).length > 0) {
      // Calculate bounding boxes for rendered overlays
      const overlayBounds = (resolvedModel.overlays || []).map(overlay => {
        const bounds = this.calculateOverlayBounds(overlay, resolvedModel.anchors);
        return { ...overlay, bounds };
      });

      this.debugRenderer.renderOverlayBounds(overlayBounds);
    }

    return { svgMarkup };
  }

  renderOverlay(overlay, resolvedModel) {
    if (!overlay || !overlay.id) return '';

    switch (overlay.type) {
      case 'text':
        return this.renderTextOverlay(overlay, resolvedModel);
      case 'line':
        return this.renderLineOverlay(overlay, resolvedModel);
      case 'sparkline':
        return this.renderSparklineOverlay(overlay, resolvedModel);
      default:
        console.warn(`[AdvancedRenderer] Unknown overlay type: ${overlay.type}`);
        return '';
    }
  }

  renderTextOverlay(overlay, resolvedModel) {
    const position = this.resolvePosition(overlay.position, resolvedModel);
    if (!position) return '';

    const style = overlay.finalStyle || overlay.style || {};
    const value = style.value || '';
    const color = style.color || 'var(--lcars-orange)';
    const fontSize = style.font_size || 14;

    return `<text id="${overlay.id}" x="${position[0]}" y="${position[1]}"
            fill="${color}" font-size="${fontSize}" data-cblcars-root="true">
            ${value}
            </text>`;
  }

  renderLineOverlay(overlay, resolvedModel) {
    const anchorPoint = this.resolvePosition(overlay.anchor, resolvedModel);
    const attachPoint = this.resolvePosition(overlay.attach_to, resolvedModel);

    if (!anchorPoint || !attachPoint) {
      console.warn(`[AdvancedRenderer] Line ${overlay.id} missing anchor or attach_to points`);
      return '';
    }

    // FIXED: Use exact RouterCore.buildRouteRequest API
    // RouterCore expects to build the request itself from an overlay and anchor points
    const routeResult = this.router.buildRouteRequest(overlay, anchorPoint, attachPoint);

    if (!routeResult) {
      console.warn(`[AdvancedRenderer] Failed to build route request for ${overlay.id}`);
      return '';
    }

    try {
      // Use router to compute path with the properly built request
      const computedRoute = this.router.computePath(routeResult);

      if (!computedRoute || !computedRoute.d) {
        console.warn(`[AdvancedRenderer] Line ${overlay.id} routing failed - no path returned`);
        return '';
      }

      const style = overlay.finalStyle || overlay.style || {};
      const color = style.color || 'var(--lcars-orange)';
      const width = style.width || 2;

      return `<path id="${overlay.id}" d="${computedRoute.d}"
              stroke="${color}" stroke-width="${width}" fill="none"
              data-cblcars-root="true" data-cblcars-type="line"/>`;

    } catch (error) {
      console.error(`[AdvancedRenderer] RouterCore.computePath failed for ${overlay.id}:`, error);

      // Fallback: direct line
      return `<line id="${overlay.id}"
              x1="${anchorPoint[0]}" y1="${anchorPoint[1]}"
              x2="${attachPoint[0]}" y2="${attachPoint[1]}"
              stroke="${(overlay.finalStyle || overlay.style || {}).color || 'var(--lcars-orange)'}"
              stroke-width="${(overlay.finalStyle || overlay.style || {}).width || 2}"
              data-cblcars-root="true" data-cblcars-type="line-fallback"
              data-error="router-failed"/>`;
    }
  }

  renderSparklineOverlay(overlay, resolvedModel) {
    const position = this.resolvePosition(overlay.position, resolvedModel);
    const size = overlay.size || [200, 60];

    if (!position) return '';

    const style = overlay.finalStyle || overlay.style || {};
    const color = style.color || 'var(--lcars-yellow)';
    const width = style.width || 2;

    // Basic sparkline container - actual data will be updated by data sources
    return `<g id="${overlay.id}" transform="translate(${position[0]}, ${position[1]})"
            data-cblcars-root="true" data-cblcars-type="sparkline">
            <rect width="${size[0]}" height="${size[1]}" fill="none" stroke="none" opacity="0.1"/>
            <path stroke="${color}" stroke-width="${width}" fill="none" data-cblcars-pending="true" style="visibility: hidden;"/>
            </g>`;
  }

  resolvePosition(position, resolvedModel) {
    if (!position) return null;

    // Anchor reference
    if (typeof position === 'string') {
      const anchor = resolvedModel.anchors?.[position];
      if (anchor && Array.isArray(anchor)) {
        return [Number(anchor[0]), Number(anchor[1])];
      }
    }

    // Direct coordinates
    if (Array.isArray(position) && position.length >= 2) {
      return [Number(position[0]), Number(position[1])];
    }

    return null;
  }

  clearOverlays(svg) {
    // Remove existing overlays
    const existing = svg.querySelectorAll('[data-cblcars-root="true"]');
    existing.forEach(el => el.remove());
  }

  reRender() {
    if (this.lastRenderArgs) {
      this.render(this.lastRenderArgs);
    }
  }

  // Get performance statistics
  getStats() {
    return {
      overlayCount: this.overlayElements.size,
      lastRenderTime: this.lastRenderTime || 0
    };
  }

  // Clear all rendered content
  clear() {
    this.overlayElements.clear();
    this.lastRenderArgs = null;
  }

  // Calculate bounding box for an overlay
  calculateOverlayBounds(overlay, anchors) {
    const pos = this.resolvePosition(overlay.position, anchors);
    if (!pos) return null;

    let width = 100, height = 20; // defaults

    if (overlay.size) {
      [width, height] = overlay.size;
    } else if (overlay.type === 'text') {
      // Estimate text bounds
      const text = overlay.style?.value || '';
      const fontSize = overlay.style?.font_size || 16;
      width = text.length * fontSize * 0.6;
      height = fontSize * 1.2;
    } else if (overlay.type === 'sparkline') {
      width = 200;
      height = 60;
    }

    return {
      x: pos[0],
      y: pos[1] - height/2,
      width,
      height
    };
  }

  // Connect debug renderer
  connectDebugRenderer(debugRenderer) {
    this.debugRenderer = debugRenderer;
    console.log('[AdvancedRenderer] Debug renderer connected');
  }
}
