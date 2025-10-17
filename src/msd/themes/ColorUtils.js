/**
 * @fileoverview ColorUtils - Complete color manipulation utilities
 *
 * Provides color transformation functions for use in computed tokens.
 * Supports hex, rgb, rgba, hsl, hsla, and CSS variable color formats.
 * Handles CSS variables by using modern CSS color-mix() for runtime computation.
 *
 * @module msd/themes/ColorUtils
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * ColorUtils - Utilities for color manipulation
 *
 * All methods handle CSS variables using CSS color-mix() for runtime computation.
 * Direct color values (hex, rgb) are computed at load time.
 */
export class ColorUtils {
  /**
   * Darken a color by percentage
   *
   * @param {string} color - Color value (hex, rgb, or CSS variable)
   * @param {number} [percent=0.2] - Percentage to darken (0-1)
   * @returns {string} Darkened color
   *
   * @example
   * ColorUtils.darken('#FF9900', 0.2) // Returns 'rgb(204, 122, 0)'
   * ColorUtils.darken('var(--lcars-orange)', 0.3) // Returns 'color-mix(in srgb, var(--lcars-orange) 70%, black 30%)'
   */
  static darken(color, percent = 0.2) {
    // Handle CSS variables with color-mix() for runtime computation
    if (this._isCssVariable(color)) {
      const percentage = Math.round(percent * 100);
      return `color-mix(in srgb, ${color} ${100 - percentage}%, black ${percentage}%)`;
    }

    // Handle direct colors - compute at load time
    const rgb = this._parseColor(color);
    if (!rgb) return color;

    const darkened = rgb.map(val => Math.max(0, Math.floor(val * (1 - percent))));
    return this._rgbToHex(darkened[0], darkened[1], darkened[2]);
  }

  /**
   * Lighten a color by percentage
   *
   * @param {string} color - Color value
   * @param {number} [percent=0.2] - Percentage to lighten (0-1)
   * @returns {string} Lightened color
   *
   * @example
   * ColorUtils.lighten('#FF9900', 0.2) // Returns 'rgb(255, 173, 51)'
   * ColorUtils.lighten('var(--lcars-orange)', 0.2) // Returns 'color-mix(in srgb, var(--lcars-orange) 80%, white 20%)'
   */
  static lighten(color, percent = 0.2) {
    // Handle CSS variables with color-mix()
    if (this._isCssVariable(color)) {
      const percentage = Math.round(percent * 100);
      return `color-mix(in srgb, ${color} ${100 - percentage}%, white ${percentage}%)`;
    }

    // Handle direct colors
    const rgb = this._parseColor(color);
    if (!rgb) return color;

    const lightened = rgb.map(val => Math.min(255, Math.floor(val + (255 - val) * percent)));
    return this._rgbToHex(lightened[0], lightened[1], lightened[2]);
  }

  /**
   * Adjust alpha/opacity of a color
   *
   * @param {string} color - Color value
   * @param {number} [alpha=1.0] - Alpha value (0-1)
   * @returns {string} Color with alpha
   *
   * @example
   * ColorUtils.alpha('#FF9900', 0.5) // Returns 'rgba(255, 153, 0, 0.5)'
   * ColorUtils.alpha('var(--lcars-orange)', 0.5) // Returns 'color-mix(in srgb, var(--lcars-orange) 50%, transparent)'
   */
  static alpha(color, alpha = 1.0) {
    // Handle CSS variables with color-mix()
    if (this._isCssVariable(color)) {
      const percentage = Math.round(alpha * 100);
      return `color-mix(in srgb, ${color} ${percentage}%, transparent)`;
    }

    // Handle direct colors
    const rgb = this._parseColor(color);
    if (!rgb) return color;

    return `rgba(${rgb.join(', ')}, ${alpha})`;
  }

  /**
   * Saturate a color (increase saturation)
   *
   * @param {string} color - Color value
   * @param {number} [percent=0.2] - Saturation increase (0-1)
   * @returns {string} Saturated color
   *
   * @example
   * ColorUtils.saturate('#FF9900', 0.3) // Returns more vibrant orange
   */
  static saturate(color, percent = 0.2) {
    // CSS variables require browser-side computation (future enhancement)
    if (this._isCssVariable(color)) {
      cblcarsLog.warn('[ColorUtils] saturate() with CSS variables not yet supported, returning original');
      return color;
    }

    const hsl = this._rgbToHsl(this._parseColor(color));
    if (!hsl) return color;

    hsl[1] = Math.min(100, hsl[1] + (percent * 100));
    return this._hslToRgbHex(hsl);
  }

  /**
   * Desaturate a color (move toward grayscale)
   *
   * @param {string} color - Color value
   * @param {number} [percent=0.2] - Desaturation amount (0-1)
   * @returns {string} Desaturated color
   *
   * @example
   * ColorUtils.desaturate('#FF9900', 0.5) // Returns muted orange
   */
  static desaturate(color, percent = 0.2) {
    // CSS variables require browser-side computation (future enhancement)
    if (this._isCssVariable(color)) {
      cblcarsLog.warn('[ColorUtils] desaturate() with CSS variables not yet supported, returning original');
      return color;
    }

    const hsl = this._rgbToHsl(this._parseColor(color));
    if (!hsl) return color;

    hsl[1] = Math.max(0, hsl[1] - (percent * 100));
    return this._hslToRgbHex(hsl);
  }

  /**
   * Mix two colors
   *
   * @param {string} color1 - First color
   * @param {string} color2 - Second color
   * @param {number} [weight=0.5] - Weight of first color (0-1)
   * @returns {string} Mixed color
   *
   * @example
   * ColorUtils.mix('#FF9900', '#9999FF', 0.5) // Returns color halfway between
   * ColorUtils.mix('var(--lcars-orange)', 'var(--lcars-blue)', 0.5) // Returns 'color-mix(in srgb, var(--lcars-orange) 50%, var(--lcars-blue) 50%)'
   */
  static mix(color1, color2, weight = 0.5) {
    // Handle CSS variables with color-mix()
    if (this._isCssVariable(color1) || this._isCssVariable(color2)) {
      const percentage1 = Math.round(weight * 100);
      const percentage2 = 100 - percentage1;
      return `color-mix(in srgb, ${color1} ${percentage1}%, ${color2} ${percentage2}%)`;
    }

    // Handle direct colors
    const rgb1 = this._parseColor(color1);
    const rgb2 = this._parseColor(color2);
    if (!rgb1 || !rgb2) return color1;

    const mixed = rgb1.map((val, i) =>
      Math.floor(val * weight + rgb2[i] * (1 - weight))
    );
    return this._rgbToHex(mixed[0], mixed[1], mixed[2]);
  }

  /**
   * Check if value is a CSS variable reference
   *
   * @private
   * @param {string} value - Value to check
   * @returns {boolean} True if CSS variable
   */
  static _isCssVariable(value) {
    return typeof value === 'string' && value.includes('var(');
  }

  /**
   * Parse color string to RGB array
   *
   * Supports:
   * - Hex: #RRGGBB or #RGB
   * - RGB: rgb(r, g, b)
   * - RGBA: rgba(r, g, b, a)
   *
   * @private
   * @param {string} color - Color string
   * @returns {Array<number>|null} [r, g, b] or null if unparseable
   */
  static _parseColor(color) {
    if (!color) return null;

    // Remove whitespace
    color = color.trim();

    // Hex format: #RRGGBB or #RGB
    if (color.startsWith('#')) {
      const hex = color.slice(1);

      // #RGB format
      if (hex.length === 3) {
        return [
          parseInt(hex[0] + hex[0], 16),
          parseInt(hex[1] + hex[1], 16),
          parseInt(hex[2] + hex[2], 16)
        ];
      }

      // #RRGGBB format
      if (hex.length === 6) {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16)
        ];
      }
    }

    // RGB/RGBA format: rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return [
        parseInt(rgbMatch[1]),
        parseInt(rgbMatch[2]),
        parseInt(rgbMatch[3])
      ];
    }

    return null;
  }

  /**
   * Convert RGB values to hex string
   *
   * @private
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @returns {string} Hex color (#RRGGBB)
   */
  static _rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = Math.max(0, Math.min(255, x)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  /**
   * Convert RGB to HSL
   *
   * @private
   * @param {Array<number>} rgb - [r, g, b] values (0-255)
   * @returns {Array<number>|null} [h, s, l] where h=0-360, s=0-100, l=0-100
   */
  static _rgbToHsl(rgb) {
    if (!rgb) return null;

    let [r, g, b] = rgb;
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // Achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return [h * 360, s * 100, l * 100];
  }

  /**
   * Convert HSL to RGB hex
   *
   * @private
   * @param {Array<number>} hsl - [h, s, l] where h=0-360, s=0-100, l=0-100
   * @returns {string} Hex color (#RRGGBB)
   */
  static _hslToRgbHex(hsl) {
    if (!hsl) return '#000000';

    let [h, s, l] = hsl;
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = l; // Achromatic
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return this._rgbToHex(
      Math.round(r * 255),
      Math.round(g * 255),
      Math.round(b * 255)
    );
  }
}
