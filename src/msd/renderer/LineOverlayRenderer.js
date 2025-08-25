/**
 * Line Overlay Renderer - Handles line/path overlay rendering using RouterCore
 */

import { PositionResolver } from './PositionResolver.js';

export class LineOverlayRenderer {
  constructor(routerCore) {
    this.routerCore = routerCore;
  }

  render(overlay, anchors, viewBox) {
    if (!this.routerCore) {
      console.error('[LineOverlayRenderer] RouterCore not available for line rendering');
      return '';
    }

    const anchor1 = PositionResolver.resolvePosition(overlay.anchor, anchors);
    const anchor2 = PositionResolver.resolvePosition(overlay.attach_to, anchors);

    if (!anchor1 || !anchor2) {
      console.warn(`[LineOverlayRenderer] Line ${overlay.id} missing anchor points`);
      return '';
    }

    try {
      const routeRequest = this.routerCore.buildRouteRequest(overlay, anchor1, anchor2);
      const pathResult = this.routerCore.computePath(routeRequest);

      if (pathResult && pathResult.d) {
        const style = overlay.finalStyle || overlay.style || {};
        const strokeColor = style.color || 'var(--lcars-orange)';
        const strokeWidth = style.width || 2;

        console.log(`[LineOverlayRenderer] Rendered line ${overlay.id}`);

        return `<path d="${pathResult.d}"
                      stroke="${strokeColor}"
                      stroke-width="${strokeWidth}"
                      fill="none"
                      data-overlay-id="${overlay.id}"
                      data-overlay-type="line"/>`;
      }
    } catch (error) {
      console.error(`[LineOverlayRenderer] Route computation failed for line ${overlay.id}:`, error);
    }

    return '';
  }
}
