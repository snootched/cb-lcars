/**
 * [MsdIntrospection] Overlay introspection utilities - provides overlay listing, highlighting, and geometry utilities
 * 🔍 Enables runtime overlay discovery, bounding box calculation, and visual highlighting for debugging
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export class MsdIntrospection {
  static getOverlaysSvg(root) {
    // Try specific wrapper IDs first (backward compatibility), then direct SVG query
    return root?.querySelector?.('#msd_svg_overlays svg') ||
           root?.querySelector?.('#cblcars-msd-wrapper svg') ||
           root?.querySelector?.('svg') || null;
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

    cblcarsLog.debug(`[MsdIntrospection] 📦 Getting bbox for overlay: ${id}`);

    // Get SVG element first - we need to search within it
    const svg = this.getOverlaysSvg(root);
    if (!svg) {
      cblcarsLog.warn(`[MsdIntrospection] ⚠️ No SVG found for bbox lookup`);
      return null;
    }

    // 1) Try SVG element getBBox using getElementById on the SVG or querySelector
    let el = svg.getElementById?.(id) || svg.querySelector(`#${CSS.escape(id)}`);
    cblcarsLog.debug(`[MsdIntrospection] 🎯 Found element for '${id}':`, !!el);

    if (el && typeof el.getBBox === 'function') {
      try {
        const gbb = el.getBBox();
        cblcarsLog.debug(`[MsdIntrospection] 📏 getBBox() result:`, gbb);
        if (gbb && Number.isFinite(gbb.width) && Number.isFinite(gbb.height)) {
          let x = gbb.x;
          let y = gbb.y;

          // Check for transform attribute (e.g., "translate(x, y)")
          const transform = el.getAttribute('transform');
          if (transform) {
            const translateMatch = transform.match(/translate\s*\(\s*([^,\s]+)[\s,]+([^)]+)\)/);
            if (translateMatch) {
              const tx = parseFloat(translateMatch[1]);
              const ty = parseFloat(translateMatch[2]);
              if (Number.isFinite(tx) && Number.isFinite(ty)) {
                x += tx;
                y += ty;
                cblcarsLog.debug(`[MsdIntrospection] 🔄 Applied transform translate(${tx}, ${ty})`);
              }
            }
          }

          return { x, y, w: gbb.width, h: gbb.height };
        }
      } catch (e) {
        cblcarsLog.debug(`[MsdIntrospection] ⚠️ getBBox() failed:`, e);
      }
    }

    // 2) Ribbon fallback: backdrop element
    const backdrop = svg.getElementById?.(`${id}_backdrop`) || svg.querySelector(`#${CSS.escape(id)}_backdrop`);
    if (backdrop && typeof backdrop.getBBox === 'function') {
      try {
        const bb2 = backdrop.getBBox();
        if (bb2 && (bb2.width > 0 || bb2.height > 0)) {
          return { x: bb2.x, y: bb2.y, w: bb2.width, h: bb2.height };
        }
      } catch (_) {}
    }

    // 3) Config fallback: compute from overlay position + size
    // Look for __msdResolvedModel on root, svg, or parent elements
    const resolvedModel = root.__msdResolvedModel || svg.__msdResolvedModel || svg.parentNode?.__msdResolvedModel || {};
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

    cblcarsLog.debug(`[MsdIntrospection] 🎯 Highlighting overlays:`, idList);
    cblcarsLog.debug(`[MsdIntrospection] 📍 Root:`, root);
    cblcarsLog.debug(`[MsdIntrospection] 🎨 SVG:`, svg);

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
      cblcarsLog.debug(`[MsdIntrospection] ✨ Created highlight layer`);
    }

    // Clear existing highlights
    highlightLayer.innerHTML = '';

    // Create highlight rectangles
    let highlightCount = 0;
    for (const id of idList) {
      const bbox = this.getOverlayBBox(id, root);
      cblcarsLog.debug(`[MsdIntrospection] 📏 BBox for ${id}:`, bbox);

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
        highlightCount++;
        cblcarsLog.debug(`[MsdIntrospection] ✅ Created highlight rect for ${id}:`, { x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h });
      } else {
        cblcarsLog.warn(`[MsdIntrospection] ⚠️ No bbox found for overlay: ${id}`);
      }
    }

    cblcarsLog.info(`[MsdIntrospection] 🎯 Created ${highlightCount} highlight(s)`);

    // Auto-clear after duration
    setTimeout(() => {
      if (highlightLayer && highlightLayer.parentNode) {
        highlightLayer.innerHTML = '';
        cblcarsLog.debug(`[MsdIntrospection] 🧹 Cleared highlights`);
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

    return [0, 0, 400, 200]; // fallback - should extract from actual SVG
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
