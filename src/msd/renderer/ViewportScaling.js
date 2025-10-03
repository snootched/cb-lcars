/**
 * [ViewportScaling] Viewport-aware scaling utility for real pixel calculations
 * 🎯 Ensures user-specified pixel values appear as expected on screen
 */

export class ViewportScaling {
  /**
   * Calculate scaling context based on real container dimensions
   * @param {Element} container - Container element (card or SVG container)
   * @param {Array} viewBox - SVG viewBox [x, y, width, height]
   * @returns {Object} Scaling context with real pixel calculations
   */
  static getScalingContext(container, viewBox) {
    if (!container || !viewBox || !Array.isArray(viewBox)) {
      return null;
    }

    try {
      // Get actual container dimensions in real pixels
      const containerRect = container.getBoundingClientRect();
      const realWidth = containerRect.width;
      const realHeight = containerRect.height;

      // SVG coordinate space dimensions
      const svgWidth = viewBox[2];
      const svgHeight = viewBox[3];

      // Reference dimensions - what users expect for "normal" sizing
      // These should be reasonable defaults for typical card sizes
      const REFERENCE_WIDTH = 400;  // Typical card width
      const REFERENCE_HEIGHT = 300; // Typical card height

      // Calculate scale factors
      const containerToReference = {
        width: realWidth / REFERENCE_WIDTH,
        height: realHeight / REFERENCE_HEIGHT,
        // Use the smaller scale to maintain proportions
        balanced: Math.min(realWidth / REFERENCE_WIDTH, realHeight / REFERENCE_HEIGHT)
      };

      const svgToContainer = {
        width: svgWidth / realWidth,
        height: svgHeight / realHeight,
        // Use the smaller scale to maintain proportions
        balanced: Math.min(svgWidth / realWidth, svgHeight / realHeight)
      };

      const context = {
        // Real container dimensions
        container: {
          width: realWidth,
          height: realHeight,
          rect: containerRect
        },

        // SVG coordinate space
        svg: {
          width: svgWidth,
          height: svgHeight,
          viewBox: viewBox
        },

        // Reference dimensions
        reference: {
          width: REFERENCE_WIDTH,
          height: REFERENCE_HEIGHT
        },

        // Scale factors for different use cases
        scales: {
          // For user-specified pixel values (fonts, spacing, etc.)
          userPixelToSvg: realWidth / svgWidth,
          svgToUserPixel: svgWidth / realWidth,

          // For responsive scaling based on container size
          containerToReference: containerToReference.balanced,

          // Combined: user pixel → real pixel → SVG coordinate
          userToSvg: (containerToReference.balanced * realWidth) / svgWidth
        },

        // Utility methods
        methods: {
          // Convert user pixel value to SVG coordinates
          userPixelToSvg: (pixels) => pixels * (realWidth / svgWidth),

          // Convert SVG coordinates to user pixel equivalent
          svgToUserPixel: (svgUnits) => svgUnits * (svgWidth / realWidth),

          // Scale user pixel value based on container size
          scaleUserPixel: (pixels) => pixels * containerToReference.balanced,

          // Get font size that appears as expected on screen
          getScaledFontSize: (userPixels) => {
            // Scale based on container size relative to reference
            const containerScale = containerToReference.balanced;
            // Convert to SVG coordinate space
            const svgScale = realWidth / svgWidth;
            return userPixels * containerScale * svgScale;
          }
        }
      };

      console.log('[ViewportScaling] Scaling context calculated:', {
        realWidth,
        realHeight,
        svgWidth,
        svgHeight,
        userToSvgScale: context.scales.userToSvg,
        containerScale: context.scales.containerToReference
      });

      return context;

    } catch (error) {
      console.warn('[ViewportScaling] Failed to calculate scaling context:', error);
      return null;
    }
  }

  /**
   * Simple font scaling for backward compatibility
   * @param {number} userPixels - Font size in user pixels
   * @param {Element} container - Container element
   * @param {Array} viewBox - SVG viewBox
   * @returns {number} Scaled font size for SVG
   */
  static scaleFontSize(userPixels, container, viewBox) {
    const context = this.getScalingContext(container, viewBox);
    if (!context) {
      // Fallback to no scaling
      return userPixels;
    }

    return context.methods.getScaledFontSize(userPixels);
  }

  /**
   * Get scaling info for debugging
   * @param {Element} container - Container element
   * @param {Array} viewBox - SVG viewBox
   * @returns {Object} Debug information
   */
  static getDebugInfo(container, viewBox) {
    const context = this.getScalingContext(container, viewBox);
    if (!context) return { error: 'No scaling context available' };

    return {
      containerSize: `${context.container.width}×${context.container.height}px`,
      svgSize: `${context.svg.width}×${context.svg.height}`,
      scales: context.scales,
      exampleFont: {
        input: '16px',
        output: context.methods.getScaledFontSize(16)
      }
    };
  }
}

export default ViewportScaling;