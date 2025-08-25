/**
 * Text Overlay Renderer - Handles text overlay rendering and styling
 */

import { PositionResolver } from './PositionResolver.js';

export class TextOverlayRenderer {
  static render(overlay, anchors, viewBox) {
    const position = PositionResolver.resolvePosition(overlay.position, anchors);
    if (!position) {
      console.warn('[TextOverlayRenderer] Text overlay position could not be resolved:', overlay.id);
      return '';
    }

    const [x, y] = position;
    const style = overlay.finalStyle || overlay.style || {};

    const text = style.value || overlay.text || '';
    const color = style.color || 'var(--lcars-orange)';
    const fontSize = style.font_size || style.fontSize || 16;

    console.log(`[TextOverlayRenderer] Rendering text overlay ${overlay.id} at (${x}, ${y}): "${text}"`);

    return `<text x="${x}" y="${y}"
                  fill="${color}"
                  font-size="${fontSize}"
                  data-overlay-id="${overlay.id}"
                  data-overlay-type="text">
              ${this.escapeXml(text)}
            </text>`;
  }

  static escapeXml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
