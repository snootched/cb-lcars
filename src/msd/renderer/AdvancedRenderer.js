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

    // NEW: Track overlay elements for efficient updates
    this.overlayElementCache = new Map(); // overlayId -> DOM element
  }

  render(resolvedModel) {
    if (!resolvedModel) {
      console.warn('[AdvancedRenderer] No resolved model provided');
      return { svgMarkup: '', overlayCount: 0 };
    }

    const { overlays = [], anchors = {}, viewBox } = resolvedModel;
    console.log(`[AdvancedRenderer] Rendering ${overlays.length} overlays with ${Object.keys(anchors).length} anchors`);

    // Clear existing overlays and retry states
    this.overlayElements.clear();
    SparklineRenderer.clearAllRetryStates(); // Clean up any pending retries

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

    // Store reference for updates - FIXED: Ensure SVG reference is captured AFTER injection
    const svg = this.mountEl?.querySelector('svg');
    this.lastRenderArgs = {
      resolvedModel,
      overlays,
      svg: svg // This should now be available
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


  /* OLD
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
  */

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

    // NEW: Build element cache after injection
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
  /*
  updateOverlayData(overlayId, sourceData) {
    // Enhanced logging to debug the data structure
    console.log('[AdvancedRenderer] updateOverlayData called:', {
      overlayId,
      hasSourceData: !!sourceData,
      sourceDataKeys: sourceData ? Object.keys(sourceData) : 'none',
      hasBuffer: !!(sourceData?.buffer),
      bufferSize: sourceData?.buffer?.size?.() || 0,
      hasLastRenderArgs: !!this.lastRenderArgs,
      hasSvg: !!this.lastRenderArgs?.svg,
      mountElExists: !!this.mountEl,
      mountElInShadowRoot: this.mountEl?.getRootNode() !== document
    });

    if (!sourceData) {
      console.warn('[AdvancedRenderer] updateOverlayData: Missing sourceData');
      return;
    }

    // Try to find SVG element if not cached or if cache is stale
    let svg = this.lastRenderArgs?.svg;
    if (!svg && this.mountEl) {
      svg = this.mountEl.querySelector('svg');
      console.log('[AdvancedRenderer] Found SVG element via fallback search:', !!svg);

      // Update cache
      if (this.lastRenderArgs) {
        this.lastRenderArgs.svg = svg;
      }
    }

    if (!svg) {
      console.warn('[AdvancedRenderer] updateOverlayData: No SVG element found in mount element');
      // Try to find via SparklineRenderer's shadow root search as last resort
      const sparklineElement = SparklineRenderer.findElementInShadowRoots(`[data-overlay-id="${overlayId}"]`);
      if (sparklineElement) {
        console.log('[AdvancedRenderer] Found sparkline element via shadow root search, proceeding with update');
        const overlay = this.lastRenderArgs?.overlays?.find(o => o.id === overlayId);
        if (overlay && overlay.type === 'sparkline') {
          SparklineRenderer.updateSparklineData(sparklineElement, overlay, sourceData);
        }
      }
      return;
    }

    const overlayElement = svg.querySelector(`[data-overlay-id="${overlayId}"]`);
    if (!overlayElement) {
      console.warn(`[AdvancedRenderer] Could not find overlay element in SVG: ${overlayId}`);
      // Try shadow root search as fallback
      const shadowElement = SparklineRenderer.findElementInShadowRoots(`[data-overlay-id="${overlayId}"]`);
      if (shadowElement) {
        console.log('[AdvancedRenderer] Found overlay element via shadow root search');
        const overlay = this.lastRenderArgs?.overlays?.find(o => o.id === overlayId);
        if (overlay && overlay.type === 'sparkline') {
          SparklineRenderer.updateSparklineData(shadowElement, overlay, sourceData);
        }
      }
      return;
    }

    const overlay = this.lastRenderArgs.overlays?.find(o => o.id === overlayId);
    if (!overlay) {
      console.warn(`[AdvancedRenderer] Could not find overlay config: ${overlayId}`);
      return;
    }

    if (overlay.type === 'sparkline') {
      SparklineRenderer.updateSparklineData(overlayElement, overlay, sourceData);
    }
  }
  */


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

  // Try cached element first
  let overlayElement = this.overlayElementCache.get(overlayId);

  if (!overlayElement) {
    console.log(`[AdvancedRenderer] No cached element for ${overlayId}, searching DOM`);

    // Fallback to DOM search
    const svg = this.lastRenderArgs?.svg || this.mountEl?.querySelector('svg');
    if (svg) {
      overlayElement = svg.querySelector(`[data-overlay-id="${overlayId}"]`);
      if (overlayElement) {
        // Update cache
        this.overlayElementCache.set(overlayId, overlayElement);
        console.log(`[AdvancedRenderer] Found and cached element for ${overlayId}`);
      }
    }

    // Final fallback to shadow root search
    if (!overlayElement) {
      overlayElement = SparklineRenderer.findElementInShadowRoots(`[data-overlay-id="${overlayId}"]`);
      if (overlayElement) {
        this.overlayElementCache.set(overlayId, overlayElement);
        console.log(`[AdvancedRenderer] Found element via shadow root search for ${overlayId}`);
      }
    }
  }

  if (!overlayElement) {
    console.warn(`[AdvancedRenderer] Could not find overlay element: ${overlayId}`);
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

    // First try to find sparklines in the mount element
    let sparklines = this.mountEl.querySelectorAll(
      `[data-source="${updateData.sourceId}"]`
    );

    // If not found and mount element is in shadow root, try shadow root search
    if (sparklines.length === 0) {
      const shadowSparkline = SparklineRenderer.findElementInShadowRoots(
        `[data-source="${updateData.sourceId}"]`
      );
      if (shadowSparkline) {
        sparklines = [shadowSparkline];
        console.log('[AdvancedRenderer] Found sparkline via shadow root search in handleDataSourceUpdate');
      }
    }

    sparklines.forEach(sparklineElement => {
      const overlay = this.lastRenderArgs.overlays?.find(o =>
        o.id === sparklineElement.getAttribute('data-overlay-id')
      );
      if (!overlay) return;

      // Use SparklineRenderer's update method
      SparklineRenderer.updateSparklineData(sparklineElement, overlay, updateData);
    });
  }

  /**
   * Clean up resources when renderer is destroyed
   */
  destroy() {
    SparklineRenderer.clearAllRetryStates();
    this.overlayElements.clear();
    this.overlayElementCache.clear();
    this.lastRenderArgs = null;
  }
}
