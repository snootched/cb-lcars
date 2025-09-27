/**
 * [MsdIntrospection] Overlay introspection utilities - provides overlay listing, highlighting, and geometry utilities
 * 🔍 Enables runtime overlay discovery, bounding box calculation, and visual highlighting for debugging
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class MsdIntrospection {
  static getOverlaysSvg(root) {
    return root?.querySelector?.('#msd_svg_overlays svg') ||
           root?.querySelector?.('#cblcars-msd-wrapper svg') || null;
  }

  static listOverlays(root) {
    const out = [];
    const svg = this.getOverlaysSvg(root);
    if (!svg) return out;

    // Get resolved model from new pipeline
    const resolvedModel = root.__msdResolvedModel || {};
    const overlaysById = new Map((resolvedModel.overlays || []).map(o => [o.id, o]));

    // Find overlay elements
    let nodes = Array.from(svg.querySelectorAll('[id][data-cblcars-root="true"]'));
    if (!nodes.length) {
      // Fallback: find any elements with IDs, excluding debug layers
      nodes = Array.from(svg.querySelectorAll('[id]'))
        .filter(n => n.id && n.id !== 'cblcars-debug-layer' && n.id !== 'cblcars-highlight-layer');
    }

    for (const node of nodes) {
      const id = node.id;
      const overlay = overlaysById.get(id);
      const bbox = this.getOverlayBBox(id, root);

      out.push({
        id,
        type: overlay?.type || node.getAttribute?.('data-cblcars-type') || node.tagName?.toLowerCase() || 'unknown',
        bbox,
        hasErrors: false, // TODO: Integration with validation system
        hasWarnings: false,
        element: node,
        config: overlay
      });
    }

    return out;
  }

  static getOverlayBBox(id, root) {
    if (!id || !root) return null;

    // 1) Try SVG element getBBox
    let el = root.getElementById?.(id);
    if (el && typeof el.getBBox === 'function') {
      try {
        const gbb = el.getBBox();
        if (gbb && Number.isFinite(gbb.width) && Number.isFinite(gbb.height)) {
          return { x: gbb.x, y: gbb.y, w: gbb.width, h: gbb.height };
        }
      } catch (_) {}
    }

    // 2) Ribbon fallback: backdrop element
    const backdrop = root.getElementById?.(`${id}_backdrop`);
    if (backdrop && typeof backdrop.getBBox === 'function') {
      try {
        const bb2 = backdrop.getBBox();
        if (bb2 && (bb2.width > 0 || bb2.height > 0)) {
          return { x: bb2.x, y: bb2.y, w: bb2.width, h: bb2.height };
        }
      } catch (_) {}
    }

    // 3) Config fallback: compute from overlay position + size
    const resolvedModel = root.__msdResolvedModel || {};
    const overlay = resolvedModel.overlays?.find(o => o.id === id);
    if (overlay && overlay.position && overlay.size) {
      const anchors = resolvedModel.anchors || {};
      const vb = resolvedModel.viewBox || [0, 0, 100, 100];
      const pos = this.resolvePointFromConfig(overlay.position, anchors, vb);
      const sz = this.resolveSizeFromConfig(overlay.size, vb);
      if (pos && sz) {
        return { x: pos[0], y: pos[1], w: sz.w, h: sz.h };
      }
    }

    return null;
  }

  static highlight(ids, opts = {}) {
    const idList = Array.isArray(ids) ? ids : [ids];
    const root = opts.root;

    // Require explicit root element - no document fallback
    if (!root) {
      cblcarsLog.warn('[MsdIntrospection] ⚠️ Root element required for highlighting');
      return;
    }

    const svg = this.getOverlaysSvg(root);
    if (!svg) {
      cblcarsLog.warn('[MsdIntrospection] ⚠️ No SVG found for highlighting');
      return;
    }

    const viewBox = this.getViewBox(root, svg) || [0, 0, 400, 200];
    const color = opts.color || '#ffcc00';
    const strokeWidth = Number.isFinite(opts.strokeWidth)
      ? opts.strokeWidth
      : Math.max(1.5, Math.round(viewBox[3] * 0.004));
    const duration = Math.max(250, opts.duration || 1500);

    // Use proper createElementNS from root's document
    const doc = root.ownerDocument || root.document;
    if (!doc || !doc.createElementNS) {
      cblcarsLog.warn('[MsdIntrospection] ⚠️ createElementNS not available');
      return;
    }

    // Ensure highlight layer exists
    let highlightLayer = svg.querySelector('#cblcars-highlight-layer');
    if (!highlightLayer) {
      highlightLayer = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
      highlightLayer.setAttribute('id', 'cblcars-highlight-layer');
      highlightLayer.style.pointerEvents = 'none';
      svg.appendChild(highlightLayer);
    }

    // Clear existing highlights
    highlightLayer.innerHTML = '';

    // Create highlight rectangles
    for (const id of idList) {
      const bbox = this.getOverlayBBox(id, root);
      if (bbox) {
        const rect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');

        rect.setAttribute('x', bbox.x);
        rect.setAttribute('y', bbox.y);
        rect.setAttribute('width', bbox.w);
        rect.setAttribute('height', bbox.h);
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', color);
        rect.setAttribute('stroke-width', strokeWidth);
        rect.setAttribute('opacity', '0.9');

        highlightLayer.appendChild(rect);
      }
    }

    // Auto-clear after duration
    setTimeout(() => {
      if (highlightLayer && highlightLayer.parentNode) {
        highlightLayer.innerHTML = '';
      }
    }, duration);
  }

  static getViewBox(root, svg) {
    if (!svg) return null;

    const viewBoxAttr = svg.getAttribute('viewBox');
    if (viewBoxAttr) {
      const parts = viewBoxAttr.split(/\s+/).map(Number);
      if (parts.length === 4) {
        return parts;
      }
    }

    return [0, 0, 400, 200]; // fallback
  }

  // Helper methods for point/size resolution
  static resolvePointFromConfig(position, anchors = {}, viewBox = [0, 0, 400, 200]) {
    const [minX, minY, vw, vh] = viewBox;
    if (!position) return null;
    if (typeof position === 'string' && anchors[position]) return anchors[position];
    if (Array.isArray(position) && position.length === 2) {
      const r = (v, axis) =>
        typeof v === 'string' && v.trim().endsWith('%')
          ? axis === 'x'
            ? minX + (parseFloat(v) / 100) * vw
            : minY + (parseFloat(v) / 100) * vh
          : Number(v);
      const x = r(position[0], 'x');
      const y = r(position[1], 'y');
      if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
    }
    return null;
  }

  static resolveSizeFromConfig(size, viewBox = [0, 0, 400, 200]) {
    if (!Array.isArray(size) || size.length !== 2) return null;
    const [, , vw, vh] = viewBox;
    const toDim = (val, max) =>
      typeof val === 'string' && val.trim().endsWith('%') ? (parseFloat(val) / 100) * max : Number(val);
    const w = toDim(size[0], vw);
    const h = toDim(size[1], vh);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
    return { w, h };
  }
}
