/**
 * Advanced Renderer - Clean implementation for MSD v1
 * Main orchestrator that delegates to specialized renderers
 */

import { TextOverlayRenderer } from './TextOverlayRenderer.js';
import { SparklineRenderer } from './SparklineRenderer.js';
import { LineOverlayRenderer } from './LineOverlayRenderer.js';

export class AdvancedRenderer {
  constructor(mountEl, routerCore) {
    this.mountEl = mountEl;
    this.routerCore = routerCore;
    this.overlayElements = new Map();
    this.lastRenderArgs = null;
    this.lineRenderer = new LineOverlayRenderer(routerCore);
  }

  render(resolvedModel) {
    if (!resolvedModel) {
      console.warn('[AdvancedRenderer] No resolved model provided');
      return { svgMarkup: '', overlayCount: 0 };
    }

    const { overlays = [], anchors = {}, viewBox } = resolvedModel;
    console.log(`[AdvancedRenderer] Rendering ${overlays.length} overlays with ${Object.keys(anchors).length} anchors`);

    // Clear existing overlays
    this.overlayElements.clear();
    if (this.mountEl) {
      const existingOverlays = this.mountEl.querySelectorAll('[data-overlay-id]');
      existingOverlays.forEach(el => el.remove());
    }

    // Render each overlay
    let svgContent = '';
    let processedCount = 0;

    overlays.forEach(overlay => {
      try {
        const overlayContent = this.renderOverlay(overlay, anchors, viewBox);
        if (overlayContent) {
          svgContent += overlayContent;
          processedCount++;
        }
      } catch (error) {
        console.warn(`[AdvancedRenderer] Failed to render overlay ${overlay.id}:`, error);
      }
    });

    // Inject SVG content
    if (svgContent && this.mountEl) {
      this.injectSvgContent(svgContent);
    }

    console.log(`[AdvancedRenderer] Rendered ${processedCount}/${overlays.length} overlays successfully`);

    // Store reference for updates
    this.lastRenderArgs = {
      resolvedModel,
      overlays,
      svg: this.mountEl?.querySelector('svg')
    };

    return {
      svgMarkup: svgContent,
      overlayCount: processedCount,
      errors: overlays.length - processedCount
    };
  }

  renderOverlay(overlay, anchors, viewBox) {
    if (!overlay || !overlay.type) {
      console.warn('[AdvancedRenderer] Invalid overlay - missing type:', overlay);
      return '';
    }

    switch (overlay.type) {
      case 'text':
        return TextOverlayRenderer.render(overlay, anchors, viewBox);
      case 'sparkline':
        return SparklineRenderer.render(overlay, anchors, viewBox);
      case 'line':
        return this.lineRenderer.render(overlay, anchors, viewBox);
      default:
        console.warn(`[AdvancedRenderer] Unknown overlay type: ${overlay.type}`);
        return '';
    }
  }

  injectSvgContent(svgContent) {
    const svg = this.mountEl.querySelector('svg');
    if (!svg) {
      console.warn('[AdvancedRenderer] No SVG element found for overlay injection');
      return;
    }

    let overlayGroup = svg.querySelector('#msd-overlay-container');
    if (!overlayGroup) {
      overlayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      overlayGroup.setAttribute('id', 'msd-overlay-container');
      svg.appendChild(overlayGroup);
    } else {
      overlayGroup.innerHTML = '';
    }

    try {
      overlayGroup.innerHTML = svgContent;
      console.log('[AdvancedRenderer] SVG content injected successfully');

      // Verify injection
      const sparklines = overlayGroup.querySelectorAll('[data-overlay-type="sparkline"]');
      const lines = overlayGroup.querySelectorAll('[data-overlay-type="line"]');
      const texts = overlayGroup.querySelectorAll('[data-overlay-type="text"]');

      console.log('[AdvancedRenderer] Injected elements:', {
        sparklines: sparklines.length,
        lines: lines.length,
        texts: texts.length
      });

    } catch (error) {
      console.error('[AdvancedRenderer] Failed to inject SVG content:', error);
    }
  }

  // === DATA UPDATE METHODS ===

  updateOverlayData(overlayId, sourceData) {
    if (!sourceData || !this.lastRenderArgs?.svg) {
      console.warn('[AdvancedRenderer] updateOverlayData: Missing data or SVG reference');
      return;
    }

    const overlayElement = this.lastRenderArgs.svg.querySelector(`[data-overlay-id="${overlayId}"]`);
    if (!overlayElement) {
      console.warn(`[AdvancedRenderer] Could not find overlay element: ${overlayId}`);
      return;
    }

    const overlay = this.lastRenderArgs.overlays?.find(o => o.id === overlayId);
    if (!overlay) return;

    if (overlay.type === 'sparkline') {
      SparklineRenderer.updateSparklineData(overlayElement, overlay, sourceData);
    }
  }

  handleDataSourceUpdate(updateData) {
    if (!this.mountEl) return;

    const sparklines = this.mountEl.querySelectorAll(
      `[data-source="${updateData.sourceId}"]`
    );

    sparklines.forEach(sparklineElement => {
      const overlay = this.lastRenderArgs.overlays?.find(o =>
        o.id === sparklineElement.getAttribute('data-overlay-id')
      );
      if (!overlay) return;

      // Use SparklineRenderer's update method
      import('./SparklineRenderer.js').then(({ SparklineRenderer }) => {
        SparklineRenderer.updateSparklineData(sparklineElement, overlay, updateData);
      });
    });
  }
}
