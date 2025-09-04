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

    // Track overlay elements for efficient updates
    this.overlayElementCache = new Map(); // overlayId -> DOM element
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

    // Store reference for updates - Ensure SVG reference is captured AFTER injection
    const svg = this.mountEl?.querySelector('svg');
    this.lastRenderArgs = {
      resolvedModel,
      overlays,
      svg: svg
    };

    console.log('[AdvancedRenderer] Stored render args:', {
      hasResolvedModel: !!this.lastRenderArgs.resolvedModel,
      overlaysCount: this.lastRenderArgs.overlays?.length || 0,
      hasSvg: !!this.lastRenderArgs.svg,
      svgId: this.lastRenderArgs.svg?.id || 'no-id'
    });

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

    // Ensure SVG container is available before rendering
    const svgContainer = this.mountEl;
    const svg = svgContainer?.querySelector('svg');

    if (!svg) {
      console.warn('[AdvancedRenderer] SVG element not found in container for overlay:', overlay.id);
    }

    switch (overlay.type) {
      case 'text':
        // Pass the mount element (which contains the SVG) for coordinate calculations
        return TextOverlayRenderer.render(overlay, anchors, viewBox, svgContainer);
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

      // Build element cache after injection
      this.overlayElementCache.clear();
      const overlayElements = overlayGroup.querySelectorAll('[data-overlay-id]');
      overlayElements.forEach(element => {
        const overlayId = element.getAttribute('data-overlay-id');
        if (overlayId) {
          this.overlayElementCache.set(overlayId, element);
          console.log(`[AdvancedRenderer] Cached element for overlay: ${overlayId}`);
        }
      });

      // Verify injection
      const sparklines = overlayGroup.querySelectorAll('[data-overlay-type="sparkline"]');
      const lines = overlayGroup.querySelectorAll('[data-overlay-type="line"]');
      const texts = overlayGroup.querySelectorAll('[data-overlay-type="text"]');

      console.log('[AdvancedRenderer] Injected elements:', {
        sparklines: sparklines.length,
        lines: lines.length,
        texts: texts.length,
        cached: this.overlayElementCache.size
      });

    } catch (error) {
      console.error('[AdvancedRenderer] Failed to inject SVG content:', error);
    }
  }

  // === DATA UPDATE METHODS ===

  /**
   * Update overlay data when data source changes
   * @param {string} overlayId - ID of the overlay to update
   * @param {Object} sourceData - Data from the data source
   */
  updateOverlayData(overlayId, sourceData) {
    console.log('[AdvancedRenderer] updateOverlayData called:', {
      overlayId,
      hasSourceData: !!sourceData,
      sourceDataKeys: sourceData ? Object.keys(sourceData) : 'none',
      hasBuffer: !!(sourceData?.buffer),
      bufferSize: sourceData?.buffer?.size?.() || 0,
      hasCachedElement: this.overlayElementCache.has(overlayId)
    });

    if (!sourceData) {
      console.warn('[AdvancedRenderer] updateOverlayData: Missing sourceData');
      return;
    }

    // Use cached element - no DOM searching needed with subscription system
    const overlayElement = this.overlayElementCache.get(overlayId);

    if (!overlayElement) {
      console.warn(`[AdvancedRenderer] Could not find cached overlay element: ${overlayId}. Element should be cached during render.`);
      return;
    }

    const overlay = this.lastRenderArgs?.overlays?.find(o => o.id === overlayId);
    if (!overlay) {
      console.warn(`[AdvancedRenderer] Could not find overlay config: ${overlayId}`);
      return;
    }

    // Delegate to type-specific renderer
    if (overlay.type === 'sparkline') {
      SparklineRenderer.updateSparklineData(overlayElement, overlay, sourceData);
    } else {
      console.warn(`[AdvancedRenderer] Update not implemented for overlay type: ${overlay.type}`);
    }
  }

  handleDataSourceUpdate(updateData) {
    if (!this.mountEl) return;

    // Find sparklines using cached elements instead of DOM search
    const cachedElements = Array.from(this.overlayElementCache.values());
    const sparklines = cachedElements.filter(el =>
      el.getAttribute('data-source') === updateData.sourceId
    );

    if (sparklines.length === 0) {
      console.log(`[AdvancedRenderer] No cached sparklines found for source: ${updateData.sourceId}`);
      return;
    }

    sparklines.forEach(sparklineElement => {
      const overlay = this.lastRenderArgs.overlays?.find(o =>
        o.id === sparklineElement.getAttribute('data-overlay-id')
      );
      if (!overlay) return;

      // Use SparklineRenderer's update method
      SparklineRenderer.updateSparklineData(sparklineElement, overlay, updateData.data);
    });
  }

  /**
   * Clean up resources when renderer is destroyed
   */
  destroy() {
    this.overlayElements.clear();
    this.overlayElementCache.clear();
    this.lastRenderArgs = null;
  }
}