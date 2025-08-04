import * as svgHelpers from './cb-lcars-svg-helpers.js';
import { resolveCalloutStyles, splitAttrsAndStyle, resolveAllDynamicValues, resolveStatePreset } from './cb-lcars-style-helpers.js';
import { animateElement } from './cb-lcars-anim-helpers.js';
import { cblcarsLog } from './cb-lcars-logging.js';

/**
 * Manages and renders SVG overlay errors.
 * This class ensures that errors can be pushed from anywhere and are rendered
 * into a dedicated container in the SVG overlay.
 */
class SvgOverlayErrorManager {
    constructor() {
        this.errors = [];
        this.containerId = 'cblcars-overlay-errors';
        this.viewBox = [0, 0, 400, 200];
        this.root = null; // The root element (e.g., shadowRoot) to search within
    }

    /**
     * Sets the root element for DOM queries. Essential for Shadow DOM.
     * @param {Element} root The root element.
     */
    setRoot(root) {
        this.root = root;
    }

    /**
     * Clears all current errors.
     */
    clear() {
        this.errors = [];
        this.render(); // Re-render to clear the display
    }

    /**
     * Adds an error message and triggers a re-render.
     * @param {string} msg The error message to display.
     */
    push(msg) {
        if (!this.errors.includes(msg)) {
            this.errors.push(msg);
            this.render();
        }
    }

    /**
     * Renders the collected errors into the SVG container.
     * If no errors are present, the container is cleared.
     */
    render() {
        // Use the stored root, default to document if not set.
        const searchRoot = this.root || document;

        // Delay rendering to allow the DOM to update first. This is crucial for
        // errors pushed during the initial render cycle before the container exists.
        setTimeout(() => {
            const container = searchRoot.querySelector(`#${this.containerId}`);
            if (!container) {
                // This can happen if the overlay is removed before the timeout fires.
                return;
            }

            if (this.errors.length === 0) {
                container.innerHTML = '';
                return;
            }

            const errorText = `<text x="${this.viewBox[0] + 10}" y="${this.viewBox[1] + 30}" fill="red" font-size="36" font-family="monospace" opacity="0.8">
                ${this.errors.map((msg, i) => `<tspan x="${this.viewBox[0] + 10}" dy="${i === 0 ? 0 : '1.2em'}">${msg}</tspan>`).join('')}
            </text>`;
            container.innerHTML = errorText;
        }, 0);
    }

    /**
     * Updates the viewBox used for positioning error messages.
     * @param {number[]} viewBox The new viewBox array.
     */
    setViewBox(viewBox) {
        if (Array.isArray(viewBox) && viewBox.length === 4) {
            this.viewBox = viewBox;
        }
    }
}

// Export a single instance to act as a global singleton
export const svgOverlayManager = new SvgOverlayErrorManager();

/**
 * A singleton utility to accurately measure text width using an off-screen canvas.
 */
const TextMeasurer = (() => {
  let canvas;
  let context;

  function getInstance() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      context = canvas.getContext('2d');
    }
    return context;
  }

  return {
    measure: (text, { fontSize = '16px', fontFamily = 'sans-serif', fontWeight = 'normal' } = {}) => {
      const ctx = getInstance();
      ctx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
      return ctx.measureText(text).width;
    },
  };
})();


/**
 * Safely evaluates a JS template string.
 * @param {string} template - The template string, e.g., "[[[ return entity.state ]]]".
 * @param {object} context - An object with context variables (e.g., { entity, hass }).
 * @returns {*} The result of the template evaluation.
 */
function evaluateTemplate(template, context = {}) {
  if (typeof template !== 'string' || !template.startsWith('[[[')) {
    return template;
  }
  try {
    const code = template.substring(3, template.length - 3);
    const func = new Function(...Object.keys(context), `return ${code}`);
    // Check if callout exists in the context before calling the function
    if (!context || !context.callout == null) {
      return 'CALLOUT_MISSING'; // Or any other suitable default value
    }
    return func(...Object.values(context));
  } catch (e) {
    cblcarsLog.error('[evaluateTemplate] Error evaluating template:', { template, context, error: e });
    return 'TEMPLATE_ERROR';
  }
}

/**
 * Generates an SVG path 'd' attribute for a right-angle line with a rounded corner.
 * @param {number[]} start - The starting [x, y] coordinates.
 * @param {number[]} end - The ending [x, y] coordinates.
 * @param {object} options - Styling options.
 * @param {number} options.radius - The corner radius.
 * @param {string} options.cornerStyle - The style of the corner: "round", "bevel", "miter", "sharp", "square".
 * @returns {string} The SVG path data.
 */
function generateRightAnglePath(start, end, { radius = 12, cornerStyle = 'round' } = {}) {
  const [x0, y0] = start;
  const [x2, y2] = end;

  // Elbow point is always at the intersection of the horizontal line from start
  // and the vertical line from the end.
  const [x1, y1] = [x2, y0];

  // If start, elbow, and end are co-linear or style is sharp, draw straight lines.
  if ((x0 === x1 && x1 === x2) || (y0 === y1 && y1 === y2) || cornerStyle === 'sharp' || cornerStyle === 'square') {
    return `M${x0},${y0} L${x1},${y1} L${x2},${y2}`;
  }

  const dx1 = x1 - x0;
  const dy2 = y2 - y1;

  const r = Math.min(radius, Math.abs(dx1) / 2, Math.abs(dy2) / 2);

  const p1 = [x1 - r * Math.sign(dx1), y1];
  const p2 = [x1, y1 + r * Math.sign(dy2)];

  if (cornerStyle === 'bevel' || cornerStyle === 'miter') {
    return `M${x0},${y0} L${p1[0]},${p1[1]} L${p2[0]},${p2[1]} L${x2},${y2}`;
  }

  // Default to 'round'
  const sweep = (dx1 > 0) === (dy2 > 0) ? 1 : 0;
  return `M${x0},${y0} L${p1[0]},${p1[1]} A${r},${r} 0 0 ${sweep} ${p2[0]},${p2[1]} L${x2},${y2}`;
}

/**
 * Generates a smooth SVG path string through points using cubic Bezier curves.
 * @param {Array<number[]>} points - Array of [x, y] points.
 * @param {object} options - Styling options.
 * @param {number} options.tension - The curve tension (0 to 1).
 * @returns {string} The SVG path data for a <path> element.
 */
function generateSmoothPath(points, { tension = 0.5 } = {}) {
  if (points.length < 2) return '';
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1] || p1;
    const p3 = points[i + 2] || p2;

    const c1x = p1[0] + (p2[0] - p0[0]) * tension / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) * tension / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) * tension / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) * tension / 6;

    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/**
 * Resolves a point from various formats (anchor name, array of numbers/percentages)
 * into absolute [x, y] coordinates based on the SVG viewBox.
 * @param {string|Array<string|number>} point - The point to resolve.
 * @param {object} context - The resolution context.
 * @param {object} context.anchors - The table of named anchor points.
 * @param {number[]} context.viewBox - The SVG viewBox [minX, minY, width, height].
 * @returns {number[]|null} The resolved [x, y] coordinates or null.
 */
function resolvePoint(point, { anchors, viewBox }) {
  // Ensure anchors is always an object
  anchors = anchors || {};
  if (!point) return null;

  // Resolve anchor name
  if (typeof point === 'string' && anchors && typeof anchors === 'object' && anchors[point]) {
    return anchors[point];
  }

  if (Array.isArray(point) && point.length === 2) {
    const [minX, minY, width, height] = viewBox;
    const resolve = (val, axis) => {
      if (typeof val === 'string' && val.endsWith('%')) {
        const percent = parseFloat(val) / 100;
        return axis === 'x' ? minX + percent * width : minY + percent * height;
      }
      return parseFloat(val);
    };
    const x = resolve(point[0], 'x');
    const y = resolve(point[1], 'y');

    if (!isNaN(x) && !isNaN(y)) {
      return [x, y];
    }
  }

  return null;
}

/**
 * Converts steps (horizontal/vertical) to waypoints based on the initial anchor position.
 * @param {string|Array} anchor - Anchor name or position.
 * @param {Array} steps - Array of step objects.
 * @param {object} context - {anchors, viewBox}
 * @returns {Array} Array of [x, y] waypoints.
 */
function generateWaypointsFromSteps(anchor, steps, context) {
  let pos = resolvePoint(anchor, context);
  if (!pos) return [];
  const points = [pos.slice()];
  for (const step of steps) {
    if (step.direction === 'horizontal' && step.to_x !== undefined) {
      pos = [parseFloat(step.to_x), pos[1]];
    } else if (step.direction === 'vertical' && step.to_y !== undefined) {
      pos = [pos[0], parseFloat(step.to_y)];
    }
    points.push(pos.slice());
  }
  return points;
}

/**
 * Builds an SVG path string using right-angle turns and corner style.
 * Supports round, square, bevel, miter corners.
 * @param {Array} points - Array of [x, y] points.
 * @param {object} options - {cornerStyle, cornerRadius}
 * @returns {string} SVG path data.
 */
function generateMultiSegmentPath(points, { cornerStyle = 'round', cornerRadius = 12 } = {}) {
  if (points.length < 2) return '';

  let d = `M${points[0][0]},${points[0][1]}`;

  for (let i = 1; i < points.length - 1; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i]; // This is the elbow point
    const [x2, y2] = points[i + 1];

    // Check for a right-angle turn. If not, just draw a line to the elbow.
    const isRightAngle = (x0 === x1 && y1 === y2) || (y0 === y1 && x1 === x2);

    if (!isRightAngle || cornerStyle === 'sharp' || cornerStyle === 'square') {
      d += ` L${x1},${y1}`;
      continue;
    }

    const dx1 = x1 - x0;
    const dy1 = y1 - y0;
    const dx2 = x2 - x1;
    const dy2 = y2 - y1;

    // Radius should not be more than half the length of the shortest segment from the corner
    const r = Math.min(cornerRadius, Math.abs(dx1 || dy1) / 2, Math.abs(dx2 || dy2) / 2);

    // Points on the segments before and after the corner
    const p1 = [x1 - Math.sign(dx1) * r, y1 - Math.sign(dy1) * r];
    const p2 = [x1 + Math.sign(dx2) * r, y1 + Math.sign(dy2) * r];

    d += ` L${p1[0]},${p1[1]}`;

    if (cornerStyle === 'round') {
      // Determine sweep flag for the arc
      const sweep = ((dx1 > 0 && dy2 > 0) || (dx1 < 0 && dy2 < 0) || (dy1 > 0 && dx2 < 0) || (dy1 < 0 && dx2 > 0)) ? 1 : 0;
      d += ` A${r},${r} 0 0 ${sweep} ${p2[0]},${p2[1]}`;
    } else if (cornerStyle === 'bevel' || cornerStyle === 'miter') {
      // For bevel and miter, just draw a line to the next point on the segment
      d += ` L${p2[0]},${p2[1]}`;
    }
  }

  // Add the final line segment to the last point
  d += ` L${points[points.length - 1][0]},${points[points.length - 1][1]}`;

  return d;
}


// --- Centralized SVG Overlay Error Manager ---
// REMOVED OLD IMPLEMENTATION

// Entry point for MSD overlays from custom button card
export function renderMsdOverlay({
  overlays,
  anchors,
  styleLayers,
  hass,
  root = document,
  viewBox = [0, 0, 400, 200],
  timelines = {},
  animations = [] // <-- Add animations param, default to []
}) {
  let svgElements = [];
  let animationsToRun = []; // Store animation configs to run after rendering
  const presets = styleLayers || {};
  const defaultPreset = presets.default || {};

  // --- Merge user anchors with SVG anchors if svgContent is provided ---
  // import { getMergedAnchors } from './cb-lcars-anchor-helpers.js'
  // anchors = getMergedAnchors(userAnchors, svgContent);
  // For now, just a comment to show where to use it:
  // If you have svgContent and user anchors, merge them here:
  // anchors = getMergedAnchors(anchors, svgContent);

  // Ensure anchors is always an object to avoid undefined errors
  if (!anchors || typeof anchors !== 'object') {
    cblcarsLog.warn('[renderMsdOverlay] anchors is missing or not an object. Overlays may not render correctly.', { anchors });
    anchors = {};
  }

  // Check if overlays is a valid array
  if (!Array.isArray(overlays)) {
    cblcarsLog.warn('[renderMsdOverlay] overlays is not a valid array, skipping.');
    return { svgMarkup: '', animationsToRun: [] }; // Return default values
  }

  // Collect all timeline targets for suppression
  const timelineTargets = new Set();
  if (timelines && typeof timelines === 'object') {
    Object.values(timelines).forEach(tl => {
      if (Array.isArray(tl.steps)) {
        tl.steps.forEach(step => {
          if (step.targets) {
            timelineTargets.add(step.targets.replace(/^#/, ''));
          }
        });
      }
    });
  }

  // --- Graceful error handling for missing anchors/IDs ---
  // Use centralized error manager
  svgOverlayManager.setRoot(root);
  svgOverlayManager.clear();
  svgOverlayManager.setViewBox(viewBox);

  overlays.forEach((callout, idx) => {
    // Check for required keys
    if (!callout) {
      const message = `Callout ${idx} is missing, skipping.`;
      cblcarsLog.warn(`[renderMsdOverlay] ${message}`);
      svgOverlayManager.push(message);
      return;
    }

    // All callout processing logic should be inside this if block
    if (callout) {
      // 1. --- Configuration Merging ---
      // Get the preset defined on the callout itself.
      const calloutPreset = (callout.preset && presets[callout.preset]) ? presets[callout.preset] : {};

      // Get the specific settings from the callout, excluding properties handled elsewhere.
      const calloutCopy = { ...callout };
      delete calloutCopy.preset;
      delete calloutCopy.state_resolver;

      // Use resolveStatePreset to get state-based overrides
      const stateOverrides = resolveStatePreset(callout, presets, hass);

      // Merge with the correct precedence:
      // 1. Default preset
      // 2. Callout's named preset
      // 3. Callout's specific settings
      // 4. State-matched preset/settings (via stateOverrides)
      let computed = resolveCalloutStyles({
        defaults: defaultPreset,
        preset: calloutPreset,
        customPreset: {},
        callout: calloutCopy,
        stateOverrides
      });
      // Recursively resolve all dynamic values (e.g., for animation durations)
      computed = resolveAllDynamicValues(computed, hass);
      cblcarsLog.debug(`[renderMsdOverlay] Callout ${idx} computed config:`, computed);

      // Prepare context for template evaluation
      const entity = callout.entity && hass.states[callout.entity] ? hass.states[callout.entity] : null;
      const templateContext = { entity, hass, callout, computed };

      // Visibility Check
      if (computed.visible !== undefined) {
        const isVisible = evaluateTemplate(computed.visible, templateContext);
        if (isVisible === false) {
          return; // Skip rendering this callout
        }
      }

      cblcarsLog.debug(`[renderMsdOverlay] Rendering MSD overlay ${idx}`, { callout, computed });

      // 2. --- Position & ID Resolution ---
      //const lineId = `msd_line_${computed.id || idx}`;
      //const textId = `msd_text_${computed.id || idx}`;
      const lineId = computed.line?.id || `msd_line_${computed.id || idx}`;
      const textId = computed.text?.id || `msd_text_${computed.id || idx}`;

      const pointContext = { anchors, viewBox };
      const anchorPos = resolvePoint(computed.anchor, pointContext);
      const textPos = resolvePoint(computed.text?.position, pointContext);

      if (computed.anchor && !anchorPos) {
        const msg = `Anchor "${computed.anchor}" not found`;
        svgOverlayManager.push(msg);
        cblcarsLog.warn(`[MSD Overlay] ${msg}`, { callout, computed, anchors });
      }
      if (computed.text?.position && !textPos) {
        const msg = `Text position "${computed.text.position}" not found`;
        svgOverlayManager.push(msg);
        cblcarsLog.warn(`[MSD Overlay] ${msg}`, { callout, computed, anchors });
      }

      // A callout is valid if it has text to render, or a line with an anchor, or a line with explicit points.
      const hasText = !!textPos;
      const hasLine = computed.line && (anchorPos || (Array.isArray(computed.line.points) && computed.line.points.length > 1));

      if ((!hasText && !hasLine)/* || errorMessages.length > 0*/) {
        // Stack error messages vertically using <tspan>, 36px apart
        // const errorText = `<text x="${viewBox[0] + 10}" y="${viewBox[1] + 30}" fill="red" font-size="36" font-family="monospace" opacity="0.8">
        //     ${errorMessages.map((msg, i) => `<tspan x="${viewBox[0] + 10}" dy="${i === 0 ? 0 : '1.2em'}">${msg}</tspan>`).join('')}
        // </text>`;
        // svgElements.push(errorText);
        // return;
      }

      // 3. --- Line & Text Smart Positioning ---
      let lineStartPos = hasText ? [...textPos] : null;
      if (computed.text && hasText) {
        const fontSize = parseFloat(computed.text.font_size) || 18;
        const textValue = evaluateTemplate(computed.text.value, templateContext);

        // Use canvas-based measurement for accurate width
        const textWidth = TextMeasurer.measure(textValue || '', {
          fontSize: `${fontSize}px`,
          fontFamily: computed.text.font_family || 'Antonio',
          fontWeight: computed.text.font_weight || 'normal',
        });

        const align = computed.text.align || 'start'; // start, middle, end
        let lineAttach = computed.text.line_attach || 'auto'; // auto, left, right, center

        // Automatic line attachment logic
        if (lineAttach === 'auto' && anchorPos) {
          lineAttach = textPos[0] < anchorPos[0] ? 'right' : 'left';
        } else if (lineAttach === 'auto') {
          lineAttach = 'center'; // Fallback if no anchor to compare against
        }

        // Calculate text block boundaries based on alignment
        let textLeft, textCenter, textRight;
        if (align === 'start' || align === 'left') {
          textLeft = textPos[0];
          textCenter = textPos[0] + textWidth / 2;
          textRight = textPos[0] + textWidth;
        } else if (align === 'end' || align === 'right') {
          textLeft = textPos[0] - textWidth;
          textCenter = textPos[0] - textWidth / 2;
          textRight = textPos[0];
        } else { // middle/center
          textLeft = textPos[0] - textWidth / 2;
          textCenter = textPos[0];
          textRight = textPos[0] + textWidth / 2;
        }

        // Determine line start X based on attachment point
        let lineStartX = textCenter; // Default to center
        if (lineAttach === 'left' || lineAttach === 'start') {
          lineStartX = textLeft;
        } else if (lineAttach === 'right' || lineAttach === 'end') {
          lineStartX = textRight;
        }

        // Apply offsets. Start with user-defined, then apply automatic if undefined.
        let xOffset = computed.text.x_offset;
        if (xOffset === undefined) {
          if (lineAttach === 'right' || lineAttach === 'end') {
            xOffset = fontSize / 2; // Automatic padding
          } else if (lineAttach === 'left' || lineAttach === 'start') {
            xOffset = -fontSize / 2; // Automatic padding
          } else {
            xOffset = 0;
          }
        }
        const yOffset = (computed.text.y_offset || 0) - (fontSize / 2.5); // Better vertical centering

        lineStartPos[0] = lineStartX + xOffset;
        lineStartPos[1] = textPos[1] + yOffset;
      }


      // 4. --- Line Rendering ---
      let lineSvg = '';
      let points = [];
      let useSmooth = false;
      // Use computed values for corner style and radius
      let cornerStyle = computed.line?.corner_style || 'round';
      let cornerRadius = computed.line?.corner_radius || 12;

      // Determine the target point for the line to connect to.
      // Priority: explicit attach_to > smart text position.
      const attachToPoint = resolvePoint(computed.attach_to, { anchors, viewBox }) || lineStartPos;

      // Prefer waypoints, then steps, then auto right-angle
      if (computed.line?.waypoints) {
        const waypointPoints = computed.line.waypoints.map(p => resolvePoint(p, { anchors, viewBox })).filter(Boolean);
        const startPoint = resolvePoint(computed.anchor, { anchors, viewBox });

        if (startPoint) {
          points = [startPoint, ...waypointPoints];
        } else {
          points = waypointPoints;
        }

        if (attachToPoint) {
          points.push(attachToPoint);
        }

        useSmooth = !!(computed.line.rounded || computed.line.smooth);
      } else if (computed.line?.steps) {
        points = generateWaypointsFromSteps(computed.anchor, computed.line.steps, { anchors, viewBox });
        if (attachToPoint) {
          points.push(attachToPoint);
        }
        useSmooth = !!(computed.line.rounded || computed.line.smooth);
      } else if (computed.anchor && attachToPoint) {
        // Auto right-angle
        const anchorPt = resolvePoint(computed.anchor, { anchors, viewBox });
        if (anchorPt) {
          // Create points for a single elbow path from anchor to text.
          // The elbow is at [anchor.x, text.y] to ensure the segment
          // connected to the text is always horizontal.
          points = [anchorPt, [anchorPt[0], attachToPoint[1]], attachToPoint];
        }
      }

      // If points are valid, render the connector
      if (points.length > 1) {
        const { attrs, style } = splitAttrsAndStyle(computed.line, 'line');
        let pathData = '';
        if (useSmooth) {
          pathData = generateSmoothPath(points, { tension: computed.line.smooth_tension });
        } else {
          pathData = generateMultiSegmentPath(points, { cornerStyle, cornerRadius });
        }
        const styleString = Object.entries(style).map(([k, v]) => `${k}:${v}`).join(';');
        const attrsString = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
        // Only standard SVG attributes, no pathLength
        lineSvg = `<path id="${computed.line?.id || `msd_line_${idx}`}" d="${pathData}" ${attrsString} style="${styleString}" fill="none" />`;
        svgElements.push(lineSvg);
      }

      // 5. --- Text Rendering ---
      let textSvg = '';
      if (computed.text && hasText) {
        // Ensure 'fill' is set from 'color' for text elements and stroke is 'none'.
        if (computed.text.color && !computed.text.fill) {
          computed.text.fill = computed.text.color;
        }
        if (computed.text.stroke === undefined) {
          computed.text.stroke = 'none';
        }

        const textConfig = { ...computed.text };
        delete textConfig.animation; // Remove animation object before processing attributes
        const { attrs, style } = splitAttrsAndStyle(textConfig, 'text');

        // If the text has a pulse animation, ensure it scales from the center.
        if (computed.text.animation?.type === 'pulse' || computed.text.animation?.type === 'glow') {
          style['transform-origin'] = 'center';
          style['transform-box'] = 'fill-box';
        }

        const textValue = evaluateTemplate(computed.text.value, templateContext);

        textSvg = svgHelpers.drawText({
          x: textPos[0], y: textPos[1],
          text: textValue,
          id: textId,
          attrs,
          style,
        });
        if (textSvg) svgElements.push(textSvg);
      }

      // 6. --- Animation ---
      const lineAnim = computed.line?.animation;
      const textAnim = computed.text?.animation;

      // Only push element-level animation if not suppressed by timeline
      if (lineAnim && lineAnim.type && hasLine && !timelineTargets.has(lineId)) {
        // Pass the entire computed line config as options to the animation preset
        const animConfig = { ...lineAnim, targets: `#${lineId}`, root, ...computed.line };

        if (lineAnim.type === 'motionpath' && lineAnim.tracer) {
          animConfig.path_selector = `#${lineId}`;
        }
        animationsToRun.push(animConfig);
      }

      if (textAnim && textAnim.type && hasText && !timelineTargets.has(textId)) {
        // Pass the entire computed text config as options
        animationsToRun.push({ ...textAnim, targets: `#${textId}`, root, ...computed.text });
      }
    }
  });

  // Add a dedicated container for error messages
  svgElements.push(`<g id="${svgOverlayManager.containerId}"></g>`);

  // Wrap all overlay elements in a single SVG container
  const svgMarkup = `<svg viewBox="${viewBox.join(' ')}" width="100%" height="100%" style="pointer-events:none;">${svgElements.join('')}</svg>`;

  // --- NEW: Merge standalone animations ---
  if (Array.isArray(animations)) {
    // Filter out animations whose targets are suppressed by timelineTargets
    animations.forEach(anim => {
      // If targets is a selector string, remove leading '#' for comparison
      let targetId = '';
      if (typeof anim.targets === 'string' && anim.targets.startsWith('#')) {
        targetId = anim.targets.slice(1);
      }
      // Only add if not suppressed by timeline
      if (!timelineTargets.has(targetId)) {
        animationsToRun.push({ ...anim, root });
      }
    });
  }

  // Return both the markup and the animations to be run
  return { svgMarkup, animationsToRun };
}

// In splitAttrsAndStyle, ensure stroke_width is mapped to stroke-width
function mapKeyToSvgAttr(key, context = '') {
  // ...existing code...
}