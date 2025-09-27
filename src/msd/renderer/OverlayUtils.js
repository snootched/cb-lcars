import { RendererUtils } from './RendererUtils.js';

/**
 * Shared utilities for overlay renderers
 * Provides common functionality without requiring inheritance
 */
export class OverlayUtils {
  /**
   * Resolve position from various formats (coordinates, anchor references)
   * @param {Array|string} position - Position specification
   * @param {Object} anchors - Available anchors
   * @returns {Array|null} [x, y] coordinates or null if invalid
   */
  static resolvePosition(position, anchors) {
    if (Array.isArray(position) && position.length >= 2) {
      return [Number(position[0]), Number(position[1])];
    }

    if (typeof position === 'string' && anchors && anchors[position]) {
      const anchor = anchors[position];
      return Array.isArray(anchor) ? [anchor[0], anchor[1]] : null;
    }

    return null;
  }

  /**
   * Compute standard attachment points for any overlay
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Available anchors
   * @returns {Object|null} Attachment points object
   */
  static computeAttachmentPoints(overlay, anchors) {
    const position = this.resolvePosition(overlay.position, anchors);
    const size = overlay.size;

    if (!position || !size || !Array.isArray(size) || size.length < 2) {
      return null;
    }

    const [x, y] = position;
    const [width, height] = size;

    return {
      id: overlay.id,
      center: [x + width / 2, y + height / 2],
      bbox: {
        left: x,
        right: x + width,
        top: y,
        bottom: y + height,
        width,
        height,
        x,
        y
      },
      points: {
        center: [x + width / 2, y + height / 2],
        top: [x + width / 2, y],
        bottom: [x + width / 2, y + height],
        left: [x, y + height / 2],
        right: [x + width, y + height / 2],
        topLeft: [x, y],
        topRight: [x + width, y],
        bottomLeft: [x, y + height],
        bottomRight: [x + width, y + height]
      }
    };
  }

  /**
   * Normalize style properties (handle snake_case and camelCase)
   * @param {Object} style - Style object
   * @returns {Object} Normalized style object
   */
  static normalizeStyle(style) {
    if (!style || typeof style !== 'object') return {};

    return {
      fontSize: style.font_size || style.fontSize || 16,
      fill: style.color || style.fill || 'var(--lcars-white)',
      fontFamily: style.font_family || style.fontFamily || 'Antonio, sans-serif',
      stroke: style.stroke || 'none',
      strokeWidth: style.stroke_width || style.strokeWidth || 1,
      opacity: style.opacity || 1,
      ...style // Include any other properties as-is
    };
  }

  /**
   * Build common SVG attributes for overlay elements
   * @param {string} overlayId - Overlay ID
   * @param {string} overlayType - Overlay type
   * @param {Object} additionalAttrs - Additional attributes
   * @returns {string} Attribute string for SVG elements
   */
  static buildSvgAttributes(overlayId, overlayType, additionalAttrs = {}) {
    const attrs = [
      `data-overlay-id="${overlayId}"`,
      `data-overlay-type="${overlayType}"`
    ];

    Object.entries(additionalAttrs).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        attrs.push(`${key}="${value}"`);
      }
    });

    return attrs.join(' ');
  }

  /**
   * Process template strings with data substitution
   * @param {string} template - Template string with {key} placeholders
   * @param {Object} data - Data object for substitution
   * @returns {string} Processed string
   */
  static processTemplate(template, data) {
    if (!template || typeof template !== 'string') return template;
    if (!data || typeof data !== 'object') return template;

    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      const value = data[key];
      return value !== undefined ? value : match;
    });
  }

  /**
   * Validate overlay configuration has required properties
   * @param {Object} overlay - Overlay configuration
   * @param {Array} requiredProps - Required property names
   * @returns {boolean} True if valid
   */
  static validateOverlay(overlay, requiredProps = ['id', 'position']) {
    if (!overlay || typeof overlay !== 'object') return false;

    return requiredProps.every(prop =>
      overlay.hasOwnProperty(prop) && overlay[prop] !== undefined
    );
  }

  /**
   * Escape XML special characters (delegates to RendererUtils)
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  static escapeXml(text) {
    return RendererUtils.escapeXml(text);
  }
}