import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Bracket Renderer - Generalized LCARS-style bracket system for all overlay types
 * Provides consistent bracket styling and positioning across the entire MSD system
 */

export class BracketRenderer {
  /**
   * Render LCARS-style brackets around any content area
   * @param {number} width - Content width
   * @param {number} height - Content height
   * @param {Object} bracketConfig - Bracket configuration
   * @param {string} overlayId - Unique identifier for this overlay
   * @returns {string} SVG markup for brackets
   */
  static render(width, height, bracketConfig, overlayId) {
    if (!bracketConfig || !bracketConfig.enabled) {
      return '';
    }

    cblcarsLog.debug(`[BracketRenderer] Rendering brackets for ${overlayId}:`, bracketConfig);

    const config = BracketRenderer.resolveBracketConfig(bracketConfig);

    switch (config.style) {
      case 'square':
        return BracketRenderer.renderSquareBrackets(width, height, config, overlayId);
      case 'rounded':
        return BracketRenderer.renderRoundedBrackets(width, height, config, overlayId);
      case 'extended':
        return BracketRenderer.renderExtendedBrackets(width, height, config, overlayId);
      case 'minimal':
        return BracketRenderer.renderMinimalBrackets(width, height, config, overlayId);
      case 'bg-grid':
        return BracketRenderer.renderBgGridBrackets(width, height, config, overlayId);
      case 'lcars':
      default:
        return BracketRenderer.renderLcarsBrackets(width, height, config, overlayId);
    }
  }

  /**
   * Resolve bracket configuration with defaults
   * @param {Object|boolean|string} bracketConfig - Input configuration
   * @returns {Object} Resolved bracket configuration
   */
  static resolveBracketConfig(bracketConfig) {
    // Handle simple boolean or string inputs
    if (bracketConfig === true) {
      bracketConfig = { enabled: true };
    } else if (typeof bracketConfig === 'string') {
      bracketConfig = { enabled: true, style: bracketConfig };
    }

    return {
      enabled: bracketConfig.enabled !== false,
      style: bracketConfig.style || 'lcars',
      color: bracketConfig.color || null, // null = inherit from content
      width: Number(bracketConfig.width || bracketConfig.strokeWidth || 2), // Line thickness
      gap: Number(bracketConfig.gap || 4), // Distance from content
      extension: Number(bracketConfig.extension || 8), // Bracket arm length
      opacity: Number(bracketConfig.opacity || 1),
      corners: bracketConfig.corners || 'both', // 'both', 'top', 'bottom', 'none'
      sides: bracketConfig.sides || 'both', // 'both', 'left', 'right', 'none'
      caps: bracketConfig.caps !== false, // Show end caps
      capLength: Number(bracketConfig.capLength || bracketConfig.extension || 8),
      radius: Number(bracketConfig.radius || 4), // Corner radius for rounded styles
      dash: bracketConfig.dash || false, // Dashed lines
      animate: bracketConfig.animate || false, // Animation support

      // NEW: Enhanced bracket control (inspired by bg-grid template)
      bracket_width: Number(bracketConfig.bracket_width || bracketConfig.extension || 8), // Physical width of bracket arms
      bracket_height: bracketConfig.bracket_height || '100%', // Height as percentage or pixels
      bracket_radius: Number(bracketConfig.bracket_radius || bracketConfig.radius || 4), // Corner radius
      inner_gap: Number(bracketConfig.inner_gap || 0), // Additional inner spacing
      fill: bracketConfig.fill || 'none' // Fill between brackets (omitted as requested, but keeping for future)
    };
  }

  /**
   * Standard LCARS brackets - classic Star Trek style
   * @private
   */
  static renderLcarsBrackets(width, height, config, overlayId) {
    const { gap, extension, width: strokeWidth, color, opacity, caps, capLength } = config;

    const paths = [];

    // Left bracket
    if (config.sides === 'both' || config.sides === 'left') {
      let leftPath = `M ${-gap - extension} 0 L ${-gap - extension} ${height}`;

      if (caps && (config.corners === 'both' || config.corners === 'top')) {
        leftPath += ` M ${-gap - extension} 0 L ${-gap} 0`;
      }
      if (caps && (config.corners === 'both' || config.corners === 'bottom')) {
        leftPath += ` M ${-gap - extension} ${height} L ${-gap} ${height}`;
      }

      paths.push(leftPath);
    }

    // Right bracket
    if (config.sides === 'both' || config.sides === 'right') {
      let rightPath = `M ${width + gap + extension} 0 L ${width + gap + extension} ${height}`;

      if (caps && (config.corners === 'both' || config.corners === 'top')) {
        rightPath += ` M ${width + gap} 0 L ${width + gap + extension} 0`;
      }
      if (caps && (config.corners === 'both' || config.corners === 'bottom')) {
        rightPath += ` M ${width + gap} ${height} L ${width + gap + extension} ${height}`;
      }

      paths.push(rightPath);
    }

    const strokeDash = config.dash ? `stroke-dasharray="4,2"` : '';
    const colorAttr = color ? `stroke="${color}"` : '';

    const bracketPaths = paths.map((path, index) =>
      `<path d="${path}"
             ${colorAttr}
             stroke-width="${strokeWidth}"
             opacity="${opacity}"
             ${strokeDash}
             fill="none"
             data-bracket-side="${index === 0 ? 'left' : 'right'}"
             data-bracket-style="lcars"/>`
    );

    cblcarsLog.debug(`[BracketRenderer] Created ${bracketPaths.length} LCARS bracket paths`);
    return `<g data-feature="brackets" data-bracket-style="lcars">${bracketPaths.join('\n')}</g>`;
  }

  /**
   * Square brackets - clean rectangular style
   * @private
   */
  static renderSquareBrackets(width, height, config, overlayId) {
    const { gap, extension, width: strokeWidth, color, opacity } = config;

    const brackets = [];

    // Left bracket
    if (config.sides === 'both' || config.sides === 'left') {
      brackets.push(
        `<rect x="${-gap - extension}" y="0"
               width="${extension}" height="${height}"
               ${color ? `stroke="${color}"` : ''}
               stroke-width="${strokeWidth}"
               opacity="${opacity}"
               fill="none"
               data-bracket-side="left"/>`
      );
    }

    // Right bracket
    if (config.sides === 'both' || config.sides === 'right') {
      brackets.push(
        `<rect x="${width + gap}" y="0"
               width="${extension}" height="${height}"
               ${color ? `stroke="${color}"` : ''}
               stroke-width="${strokeWidth}"
               opacity="${opacity}"
               fill="none"
               data-bracket-side="right"/>`
      );
    }

    cblcarsLog.debug(`[BracketRenderer] Created ${brackets.length} square brackets`);
    return `<g data-feature="brackets" data-bracket-style="square">${brackets.join('\n')}</g>`;
  }

  /**
   * Rounded brackets - smooth curved style
   * @private
   */
  static renderRoundedBrackets(width, height, config, overlayId) {
    const { gap, extension, width: strokeWidth, color, opacity, radius } = config;

    const paths = [];

    // Left bracket - rounded
    if (config.sides === 'both' || config.sides === 'left') {
      const leftPath = `M ${-gap - extension + radius} 0
                        Q ${-gap - extension} 0 ${-gap - extension} ${radius}
                        L ${-gap - extension} ${height - radius}
                        Q ${-gap - extension} ${height} ${-gap - extension + radius} ${height}`;
      paths.push(leftPath);
    }

    // Right bracket - rounded
    if (config.sides === 'both' || config.sides === 'right') {
      const rightPath = `M ${width + gap + extension - radius} 0
                         Q ${width + gap + extension} 0 ${width + gap + extension} ${radius}
                         L ${width + gap + extension} ${height - radius}
                         Q ${width + gap + extension} ${height} ${width + gap + extension - radius} ${height}`;
      paths.push(rightPath);
    }

    const colorAttr = color ? `stroke="${color}"` : '';
    const bracketPaths = paths.map((path, index) =>
      `<path d="${path}"
             ${colorAttr}
             stroke-width="${strokeWidth}"
             opacity="${opacity}"
             fill="none"
             data-bracket-side="${index === 0 ? 'left' : 'right'}"
             data-bracket-style="rounded"/>`
    );

    cblcarsLog.debug(`[BracketRenderer] Created ${bracketPaths.length} rounded brackets`);
    return `<g data-feature="brackets" data-bracket-style="rounded">${bracketPaths.join('\n')}</g>`;
  }

  /**
   * Extended brackets - longer with additional details
   * @private
   */
  static renderExtendedBrackets(width, height, config, overlayId) {
    const { gap, extension, width: strokeWidth, color, opacity } = config;
    const extendedLength = extension * 1.5;

    const paths = [];

    // Left extended bracket
    if (config.sides === 'both' || config.sides === 'left') {
      let leftPath = `M ${-gap - extendedLength} 0 L ${-gap - extendedLength} ${height}`;
      leftPath += ` M ${-gap - extendedLength} 0 L ${-gap} 0`;
      leftPath += ` M ${-gap - extendedLength} ${height} L ${-gap} ${height}`;
      // Add middle connection
      leftPath += ` M ${-gap - extendedLength/2} ${height/2 - extension/2} L ${-gap - extendedLength/2} ${height/2 + extension/2}`;
      paths.push(leftPath);
    }

    // Right extended bracket
    if (config.sides === 'both' || config.sides === 'right') {
      let rightPath = `M ${width + gap + extendedLength} 0 L ${width + gap + extendedLength} ${height}`;
      rightPath += ` M ${width + gap} 0 L ${width + gap + extendedLength} 0`;
      rightPath += ` M ${width + gap} ${height} L ${width + gap + extendedLength} ${height}`;
      // Add middle connection
      rightPath += ` M ${width + gap + extendedLength/2} ${height/2 - extension/2} L ${width + gap + extendedLength/2} ${height/2 + extension/2}`;
      paths.push(rightPath);
    }

    const colorAttr = color ? `stroke="${color}"` : '';
    const bracketPaths = paths.map((path, index) =>
      `<path d="${path}"
             ${colorAttr}
             stroke-width="${strokeWidth}"
             opacity="${opacity}"
             fill="none"
             data-bracket-side="${index === 0 ? 'left' : 'right'}"
             data-bracket-style="extended"/>`
    );

    cblcarsLog.debug(`[BracketRenderer] Created ${bracketPaths.length} extended brackets`);
    return `<g data-feature="brackets" data-bracket-style="extended">${bracketPaths.join('\n')}</g>`;
  }

  /**
   * Minimal brackets - simple corner marks
   * @private
   */
  static renderMinimalBrackets(width, height, config, overlayId) {
    const { gap, extension, width: strokeWidth, color, opacity } = config;
    const cornerSize = extension / 2;

    const paths = [];

    // Corner brackets instead of full sides
    if (config.sides === 'both' || config.sides === 'left') {
      // Top-left corner
      if (config.corners === 'both' || config.corners === 'top') {
        paths.push(`M ${-gap - cornerSize} 0 L ${-gap} 0 L ${-gap} ${cornerSize}`);
      }
      // Bottom-left corner
      if (config.corners === 'both' || config.corners === 'bottom') {
        paths.push(`M ${-gap} ${height - cornerSize} L ${-gap} ${height} L ${-gap - cornerSize} ${height}`);
      }
    }

    if (config.sides === 'both' || config.sides === 'right') {
      // Top-right corner
      if (config.corners === 'both' || config.corners === 'top') {
        paths.push(`M ${width + gap + cornerSize} 0 L ${width + gap} 0 L ${width + gap} ${cornerSize}`);
      }
      // Bottom-right corner
      if (config.corners === 'both' || config.corners === 'bottom') {
        paths.push(`M ${width + gap} ${height - cornerSize} L ${width + gap} ${height} L ${width + gap + cornerSize} ${height}`);
      }
    }

    const colorAttr = color ? `stroke="${color}"` : '';
    const bracketPaths = paths.map((path, index) =>
      `<path d="${path}"
             ${colorAttr}
             stroke-width="${strokeWidth}"
             opacity="${opacity}"
             fill="none"
             data-bracket-corner="${index}"
             data-bracket-style="minimal"/>`
    );

    cblcarsLog.debug(`[BracketRenderer] Created ${bracketPaths.length} minimal bracket corners`);
    return `<g data-feature="brackets" data-bracket-style="minimal">${bracketPaths.join('\n')}</g>`;
  }

  /**
   * BG-Grid style brackets - sophisticated brackets with configurable width, height, and radius
   * Inspired by the cb-lcars-animation-bg-grid template
   * @private
   */
  static renderBgGridBrackets(width, height, config, overlayId) {
    const bracketWidth = config.bracket_width;
    const bracketColor = config.color || 'var(--lcars-yellow)';
    const bracketRadius = config.bracket_radius;
    const gap = config.gap;
    const opacity = config.opacity;
    const strokeWidth = config.width;

    // Calculate bracket height - support percentage or absolute values
    let bracketHeight;
    if (typeof config.bracket_height === 'string' && config.bracket_height.includes('%')) {
      const percent = parseFloat(config.bracket_height) / 100;
      bracketHeight = height * percent;
    } else if (typeof config.bracket_height === 'number') {
      bracketHeight = config.bracket_height;
    } else {
      bracketHeight = height * 0.7; // Default 70% of height
    }

    // Center the brackets vertically
    const bracketY = (height - bracketHeight) / 2;

    // Bracket horizontal positions
    const leftX = -gap - bracketWidth;
    const rightX = width + gap;

    // SVG path for a bracket with rounded corners (left or right)
    function bracketPath(x, y, w, h, radius, side = 'left') {
      if (side === 'left') {
        // Left bracket: open to the right
        return `
          M ${x + w} ${y}
          H ${x + radius}
          Q ${x} ${y} ${x} ${y + radius}
          V ${y + h - radius}
          Q ${x} ${y + h} ${x + radius} ${y + h}
          H ${x + w}
        `;
      } else {
        // Right bracket: open to the left
        return `
          M ${x} ${y}
          H ${x + w - radius}
          Q ${x + w} ${y} ${x + w} ${y + radius}
          V ${y + h - radius}
          Q ${x + w} ${y + h} ${x + w - radius} ${y + h}
          H ${x}
        `;
      }
    }

    const brackets = [];

    // Left bracket
    if (config.sides === 'both' || config.sides === 'left') {
      brackets.push(
        `<path d="${bracketPath(leftX, bracketY, bracketWidth, bracketHeight, bracketRadius, 'left')}"
               fill="none"
               stroke="${bracketColor}"
               stroke-width="${strokeWidth}"
               stroke-linecap="round"
               opacity="${opacity}"
               data-bracket-side="left"
               data-bracket-style="bg-grid"/>`
      );
    }

    // Right bracket
    if (config.sides === 'both' || config.sides === 'right') {
      brackets.push(
        `<path d="${bracketPath(rightX, bracketY, bracketWidth, bracketHeight, bracketRadius, 'right')}"
               fill="none"
               stroke="${bracketColor}"
               stroke-width="${strokeWidth}"
               stroke-linecap="round"
               opacity="${opacity}"
               data-bracket-side="right"
               data-bracket-style="bg-grid"/>`
      );
    }

    cblcarsLog.debug(`[BracketRenderer] Created ${brackets.length} bg-grid style brackets with width=${bracketWidth}, height=${bracketHeight}, radius=${bracketRadius}`);
    return `<g data-feature="brackets" data-bracket-style="bg-grid">${brackets.join('\n')}</g>`;
  }

  /**
   * Get available bracket styles and their capabilities
   * @returns {Object} Bracket capabilities
   */
  static getCapabilities() {
    return {
      styles: ['lcars', 'square', 'rounded', 'extended', 'minimal', 'bg-grid'],
      options: {
        color: 'Bracket color (inherits if null)',
        width: 'Stroke width (default: 2)',
        gap: 'Gap from content (default: 4)',
        extension: 'Bracket extension length (default: 8)',
        opacity: 'Bracket opacity (default: 1)',
        corners: 'Corner display: both, top, bottom, none',
        sides: 'Side display: both, left, right, none',
        caps: 'Show end caps (default: true)',
        radius: 'Corner radius for rounded style',
        dash: 'Dashed line style',
        animate: 'Animation support (future)',
        // Enhanced bg-grid options
        bracket_width: 'Physical width of bracket arms (bg-grid style)',
        bracket_height: 'Height as percentage (e.g. "70%") or pixels (bg-grid style)',
        bracket_radius: 'Corner radius for bg-grid brackets'
      },
      examples: {
        simple: 'true',
        styled: '{ enabled: true, style: "lcars", color: "var(--lcars-orange)" }',
        custom: '{ enabled: true, style: "extended", gap: 8, extension: 12, width: 3 }',
        bgGrid: '{ enabled: true, style: "bg-grid", bracket_width: 16, bracket_height: "80%", bracket_radius: 8, color: "var(--lcars-yellow)" }'
      }
    };
  }
}

// Expose BracketRenderer for debugging
if (typeof window !== 'undefined') {
  window.BracketRenderer = BracketRenderer;
}