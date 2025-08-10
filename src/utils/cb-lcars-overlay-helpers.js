import * as svgHelpers from './cb-lcars-svg-helpers.js';
import { resolveOverlayStyles, splitAttrsAndStyle, resolveAllDynamicValues, resolveStatePreset } from './cb-lcars-style-helpers.js';
import { animateElement } from './cb-lcars-anim-helpers.js';
import { cblcarsLog } from './cb-lcars-logging.js';
import { bindRealtimeToElement } from './cb-lcars-overlay-helpers-live.js';
import { sliceWindow, computeYRange, mapToRect, pathFromPoints, areaPathFromPoints, mapToRectIndex } from './cb-lcars-sparkline-helpers.js';
import { resolveSize } from './cb-lcars-size-helpers.js';
import { parseTimeWindowMs } from './cb-lcars-time-utils.js';


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
        const searchRoot = this.root || document;

        // Use rAF to align with DOM paint; double-rAF to ensure container exists after SVG inject
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const container = searchRoot.querySelector(`#${this.containerId}`);
                if (!container) {
                    return;
                }

                if (this.errors.length === 0) {
                    container.innerHTML = '';
                    return;
                }

                const [, , , viewBoxHeight] = this.viewBox;
                const fontSize = Math.max(8, Math.min(48, Math.round(viewBoxHeight * 0.12)));

                const errorText = `<text x="${this.viewBox[0] + 10}" y="${this.viewBox[1] + fontSize}" fill="red" font-size="${fontSize}" font-family="monospace" opacity="0.8">
                    ${this.errors.map((msg, i) => `<tspan x="${this.viewBox[0] + 10}" dy="${i === 0 ? 0 : '1.2em'}">${msg}</tspan>`).join('')}
                </text>`;
                container.innerHTML = errorText;
            });
        });
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
    // Execute with provided context; avoid premature "callout" checks
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
 * Drop any invalid points and de-dupe consecutive duplicates.
 * @param {Array<[number,number]>} points
 * @returns {Array<[number,number]>}
 */
function sanitizePoints(points) {
  if (!Array.isArray(points)) return [];
  const out = [];
  let lastX, lastY, haveLast = false;
  for (const p of points) {
    if (!p || p.length < 2) continue;
    const x = Number(p[0]);
    const y = Number(p[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (haveLast && x === lastX && y === lastY) continue;
    out.push([x, y]);
    lastX = x; lastY = y; haveLast = true;
  }
  return out;
}

/**
 * Generates a smooth SVG path string through points using Catmull–Rom → Bezier.
 * Tension: 0 => very curvy (larger handles), 1 => nearly straight.
 * Falls back to straight segments if the input is invalid.
 * @param {Array<[number,number]>} pts
 * @param {{tension?:number}} options
 * @returns {string}
 */
function generateSmoothPath(pts, { tension = 0.5 } = {}) {
  let points = sanitizePoints(pts);
  if (points.length < 2) {
    // Fallback to straight line or nothing
    try {
      return pathFromPoints(points);
    } catch (_) {
      return '';
    }
  }

  // Clamp and compute handle factor
  const k = Math.max(0, Math.min(1, Number(tension)));
  const handle = (1 - k) * 0.5;

  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1] || p1;
    const p3 = points[i + 2] || p2;

    const c1x = p1[0] + (p2[0] - p0[0]) * handle;
    const c1y = p1[1] + (p2[1] - p0[1]) * handle;
    const c2x = p2[0] - (p3[0] - p1[0]) * handle;
    const c2y = p2[1] - (p3[1] - p1[1]) * handle;

    // Guard any non-finite intermediate
    if (
      !Number.isFinite(c1x) || !Number.isFinite(c1y) ||
      !Number.isFinite(c2x) || !Number.isFinite(c2y) ||
      !Number.isFinite(p2[0]) || !Number.isFinite(p2[1])
    ) {
      // Fallback: straight segment to p2
      d += ` L${p2[0]},${p2[1]}`;
    } else {
      d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
    }
  }

  return d;
}

/**
 * Generates a monotone cubic (Fritsch–Carlson) smooth SVG path through points.
 * Avoids overshoot while staying C1 continuous.
 * @param {Array<[number,number]>} pts
 * @returns {string}
 */
function generateMonotonePath(pts) {
  const points = sanitizePoints(pts);
  const n = points.length;
  if (n < 2) return pathFromPoints(points);

  // Compute slopes (delta) and secants
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const dx = Array(n - 1);
  const dy = Array(n - 1);
  const m = Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i];
    dy[i] = ys[i + 1] - ys[i];
    m[i] = dy[i] / (dx[i] || 1e-9);
  }

  // Tangents
  const t = Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      t[i] = 0;
    } else {
      t[i] = (m[i - 1] + m[i]) / 2;
    }
  }

  // Adjust tangents to preserve monotonicity
  for (let i = 0; i < n - 1; i++) {
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      t[i] = tau * a * m[i];
      t[i + 1] = tau * b * m[i];
    }
  }

  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const x0 = xs[i], y0 = ys[i];
    const x1 = xs[i + 1], y1 = ys[i + 1];
    const h = x1 - x0 || 1e-9;
    const c1x = x0 + h / 3;
    const c1y = y0 + (t[i] * h) / 3;
    const c2x = x1 - h / 3;
    const c2y = y1 - (t[i + 1] * h) / 3;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${x1},${y1}`;
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


// Entry point for MSD overlays from custom button card
export function renderMsdOverlay({
  overlays,
  anchors,
  styleLayers,
  hass,
  root = document,
  viewBox = [0, 0, 400, 200],
  timelines = {},
  animations = [],
  dataSources = {}
}) {
  let svgElements = [];
  let animationsToRun = [];
  const presets = styleLayers || {};
  const defaultPreset = presets.default || {};

  if (!anchors || typeof anchors !== 'object') {
    cblcarsLog.warn('[renderMsdOverlay] anchors is missing or not an object. Overlays may not render correctly.', { anchors });
    anchors = {};
  }
  if (!Array.isArray(overlays)) {
    cblcarsLog.warn('[renderMsdOverlay] overlays is not a valid array, skipping.');
    return { svgMarkup: '', animationsToRun: [] };
  }

  const timelineTargets = new Set();
  if (timelines && typeof timelines === 'object') {
    Object.values(timelines).forEach(tl => {
      if (Array.isArray(tl.steps)) {
        tl.steps.forEach(step => {
          const t = step.targets;
          if (!t) return;
          const add = (sel) => {
            if (typeof sel === 'string' && sel.startsWith('#')) timelineTargets.add(sel.slice(1));
          };
          Array.isArray(t) ? t.forEach(add) : add(t);
        });
      }
    });
  }

  svgOverlayManager.setRoot(root);
  svgOverlayManager.clear();
  svgOverlayManager.setViewBox(viewBox);

  const textMetrics = {};
  overlays.forEach((overlay) => {
    if (overlay.type === 'text' && overlay.id) {
      const tempPreset = (overlay.preset && presets[overlay.preset]?.text) ? presets[overlay.preset].text : {};
      const tempDefaults = (defaultPreset?.text) ? defaultPreset.text : {};
      const tempComputed = resolveOverlayStyles({ defaults: tempDefaults, preset: tempPreset, overlay });

      const textValue = evaluateTemplate(tempComputed.value, { hass });
      const fontSize = parseFloat(tempComputed.font_size) || 18;
      const fontFamily = tempComputed.font_family || 'Antonio';
      const fontWeight = tempComputed.font_weight || 'normal';

      textMetrics[overlay.id] = {
        width: TextMeasurer.measure(textValue || '', { fontSize: `${fontSize}px`, fontFamily, fontWeight }),
        align: tempComputed.align || 'start',
        line_attach: tempComputed.line_attach || 'auto',
        font_size: fontSize,
        y_offset: tempComputed.y_offset || 0,
        x_offset: tempComputed.x_offset,
      };
    }
  });

  overlays.forEach((overlay, idx) => {
    if (!overlay) return;

    const elementId = overlay.id;
    if (elementId && anchors && Object.prototype.hasOwnProperty.call(anchors, elementId)) {
      const msg = `Overlay ID "${elementId}" conflicts with anchorTable entry. Overlay IDs must be unique.`;
      cblcarsLog.error('[renderMsdOverlay] ' + msg, { overlay, anchors });
      svgOverlayManager.push(msg);
      return;
    }

    const overlayPreset = (overlay.preset && presets[overlay.preset]) ? presets[overlay.preset] : {};
    const overlayCopy = { ...overlay };
    delete overlayCopy.preset;
    delete overlayCopy.state_resolver;

    let stateOverridesRaw = resolveStatePreset(overlay, presets, hass);
    let stateOverrides = stateOverridesRaw && typeof stateOverridesRaw === 'object' ? { ...stateOverridesRaw } : {};
    if (overlay.type && stateOverrides && typeof stateOverrides === 'object') {
      const typeKey = overlay.type;
      if (stateOverrides[typeKey] && typeof stateOverrides[typeKey] === 'object') {
        stateOverrides = { ...stateOverrides, ...stateOverrides[typeKey] };
        delete stateOverrides[typeKey];
      }
    }

    const type = overlay.type;
    const defaultTypePreset = (defaultPreset && defaultPreset[type]) ? defaultPreset[type] : {};
    const overlayTypePreset = (overlayPreset && overlayPreset[type]) ? overlayPreset[type] : {};

    let computed = resolveOverlayStyles({
      defaults: defaultTypePreset,
      preset: overlayTypePreset,
      customPreset: {},
      overlay: overlayCopy,
      stateOverrides,
      dataSources: {}
    });
    computed = resolveAllDynamicValues(computed, hass);

    const entity = overlay.entity && hass.states[overlay.entity] ? hass.states[overlay.entity] : null;
    const templateContext = { entity, hass, overlay, computed };

    if (computed.visible !== undefined) {
      const isVisible = evaluateTemplate(computed.visible, templateContext);
      if (isVisible === false) return;
    }

    const pointContext = { anchors, viewBox };
    const isText = computed.type === 'text';
    const isLine = computed.type === 'line';
    const isSparkline = computed.type === 'sparkline';

    // SPARKLINE
    // SPARKLINE
    if (isSparkline) {
      const srcName = computed.source;
      if (!srcName) {
        svgOverlayManager.push(`Sparkline "${computed.id || `spark_${idx}`}" requires "source".`);
        return;
      }

      // Resolve position and size with percent support
      const posPt = resolvePoint(computed.position, pointContext);
      const sizeAbs = resolveSize(computed.size, viewBox);
      if (!posPt || !sizeAbs) {
        svgOverlayManager.push(`Sparkline "${computed.id || `spark_${idx}`}" requires position (anchor or [x,y]) and size [w,h].`);
        return;
      }
      const rect = { x: Number(posPt[0]), y: Number(posPt[1]), w: Number(sizeAbs.w), h: Number(sizeAbs.h) };

      const elementId = computed.id || `spark_${idx}`;
      const stroke = computed.color || computed.stroke || 'var(--lcars-yellow)';
      const strokeWidth = computed.width || computed['stroke-width'] || 2;
      const areaFill = computed.area_fill || null;

      let msWindow = parseTimeWindowMs(computed.windowSeconds);
      if (!Number.isFinite(msWindow)) {
        const ws = typeof computed.windowSeconds === 'number' ? computed.windowSeconds : 3600;
        msWindow = ws * 1000;
      }
      msWindow = Math.max(1000, msWindow);

      const yRangeCfg = Array.isArray(computed.y_range) ? computed.y_range : null;

      // Options
      const xMode = computed.x_mode === 'index' ? 'index' : 'time';
      const extendToEdges = computed.extend_to_edges === true || computed.extend_to_edges === 'both';
      const extendLeft = extendToEdges || computed.extend_to_edges === 'left';
      const extendRight = extendToEdges || computed.extend_to_edges === 'right';
      const ignoreZeroForScale = computed.ignore_zero_for_scale === true;
      const stairStep = computed.stair_step === true;
      const smooth = computed.smooth === true;
      const smoothTension = Number.isFinite(computed.smooth_tension) ? Math.max(0, Math.min(1, computed.smooth_tension)) : 0.5;
      const smoothMethod = (computed.smooth_method || 'catmull').toLowerCase();

      // Markers (restored)
      const showMarkers = !!computed.markers;
      const markerRadius = Math.max(0, Number(computed.markers?.r ?? 0));
      const markerFill = computed.markers?.fill || stroke;
      const markersMax = Number.isFinite(computed.markers?.max) ? Math.max(1, computed.markers.max) : 200;

      // Grid
      const gridCfg = computed.grid && typeof computed.grid === 'object' ? computed.grid : null;
      if (gridCfg) {
        const gx = Math.max(0, Number(gridCfg.x ?? 0));
        const gy = Math.max(0, Number(gridCfg.y ?? 0));
        const gStroke = gridCfg.color || 'rgba(255,255,255,0.12)';
        const gOpacity = gridCfg.opacity ?? 0.5;
        const gWidth = gridCfg.width ?? 1;
        let grid = `<g id="${elementId}_grid" opacity="${gOpacity}" stroke="${gStroke}" stroke-width="${gWidth}">`;
        if (gx > 0) {
          const dx = rect.w / gx;
          for (let i = 1; i < gx; i++) {
            const x = rect.x + i * dx;
            grid += `<line x1="${x}" y1="${rect.y}" x2="${x}" y2="${rect.y + rect.h}" />`;
          }
        }
        if (gy > 0) {
          const dy = rect.h / gy;
          for (let i = 1; i < gy; i++) {
            const y = rect.y + i * dy;
            grid += `<line x1="${rect.x}" y1="${y}" x2="${rect.x + rect.w}" y2="${y}" />`;
          }
        }
        grid += `</g>`;
        svgElements.push(grid);
      }

      // Optional fade gradient
      const fadeTail = computed.fade_tail && typeof computed.fade_tail === 'object' ? computed.fade_tail : null;
      const fadeStart = Number.isFinite(fadeTail?.start_opacity) ? fadeTail.start_opacity : 0.15;
      const fadeEnd = Number.isFinite(fadeTail?.end_opacity) ? fadeTail.end_opacity : 1;
      if (fadeTail) {
        const gradId = `${elementId}_grad`;
        svgElements.push(
          `<defs id="${elementId}_defs">
            <linearGradient id="${gradId}" x1="${rect.x}" y1="${rect.y}" x2="${rect.x + rect.w}" y2="${rect.y}" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="${stroke}" stop-opacity="${fadeStart}"/>
              <stop offset="100%" stop-color="${stroke}" stop-opacity="${fadeEnd}"/>
            </linearGradient>
          </defs>`
        );
      }

      // Stamp base paths
      const strokeAttr = fadeTail ? `stroke="url(#${elementId}_grad)"` : `stroke="${stroke}"`;
      svgElements.push(`<path id="${elementId}" fill="none" ${strokeAttr} stroke-width="${strokeWidth}" d="" />`);
      if (areaFill) {
        svgElements.push(`<path id="${elementId}_area" fill="${areaFill}" stroke="none" d="" />`);
      }
      if (showMarkers && markerRadius > 0) {
        svgElements.push(`<g id="${elementId}_markers"></g>`);
      }

      // Optional last value label
      const labelCfg = computed.label_last && typeof computed.label_last === 'object' ? computed.label_last : null;
      if (labelCfg) {
        const labelFill = labelCfg.fill || stroke;
        const labelFontSize = labelCfg.font_size || 14;
        svgElements.push(
          `<text id="${elementId}_label" x="${rect.x}" y="${rect.y}" fill="${labelFill}" font-size="${labelFontSize}" font-family="Antonio" dominant-baseline="central"></text>`
        );
      }

      // Optional tracer
      const tracerCfg = (computed.tracer && typeof computed.tracer === 'object') ? computed.tracer : null;
      const tracerR = tracerCfg?.r ?? 0;
      const tracerFill = tracerCfg?.fill || stroke;
      if (tracerCfg && tracerR > 0) {
        svgElements.push(`<circle id="${elementId}_tracer" cx="${rect.x + rect.w}" cy="${rect.y + rect.h/2}" r="${tracerR}" fill="${tracerFill}"></circle>`);
        if (tracerCfg.animation && tracerCfg.animation.type) {
          animationsToRun.push({ ...tracerCfg.animation, targets: `#${elementId}_tracer`, root });
        }
      }

      // Overlay-level animation on the line path (restored)
      if (computed.animation && computed.animation.type && !timelineTargets.has(elementId)) {
        animationsToRun.push({ ...computed.animation, targets: `#${elementId}`, root });
      }

      // After-stamp: wire data
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          try {
            if (window.cblcars?.data?.ensureSources && dataSources && Object.keys(dataSources).length) {
              await window.cblcars.data.ensureSources(dataSources, hass);
            }
            const src = window.cblcars?.data?.getSource?.(srcName);
            const rootEl = root;
            const pathEl = rootEl?.querySelector?.(`#${elementId}`);
            const areaEl = areaFill ? rootEl?.querySelector?.(`#${elementId}_area`) : null;
            const labelEl = labelCfg ? rootEl?.querySelector?.(`#${elementId}_label`) : null;
            const tracerEl = tracerCfg && tracerR > 0 ? rootEl?.querySelector?.(`#${elementId}_tracer`) : null;
            const markersEl = showMarkers && markerRadius > 0 ? rootEl?.querySelector?.(`#${elementId}_markers`) : null;
            if (!src || !pathEl) return;

            const toStairPoints = (pts) => {
              if (!pts || pts.length < 2) return pts || [];
              const out = [];
              for (let i = 0; i < pts.length - 1; i++) {
                const [x1, y1] = pts[i];
                const [x2] = pts[i + 1];
                out.push([x1, y1], [x2, y1]);
              }
              out.push(pts[pts.length - 1]);
              return out;
            };

            const areaPathFromSmooth = (lineD, firstPt, lastPt, rect) => {
              if (!lineD || !firstPt || !lastPt) return '';
              const baselineY = rect.y + rect.h;
              const body = lineD.startsWith('M') ? lineD.slice(1) : lineD;
              return `M${firstPt[0]},${baselineY} L${firstPt[0]},${firstPt[1]} ${body} L${lastPt[0]},${baselineY} Z`;
            };

            const refresh = () => {
              const slice = src.buffer.sliceSince ? src.buffer.sliceSince(msWindow) : sliceWindow(src.buffer, msWindow);
              const t = slice.t || [];
              const v = slice.v || [];

              if (!t.length) {
                const y0 = rect.y + rect.h;
                pathEl.setAttribute('d', `M${rect.x},${y0} L${rect.x + rect.w},${y0}`);
                pathEl.setAttribute('data-cblcars-pending', 'true');   // ADD
                if (areaEl) areaEl.setAttribute('d', '');
                if (labelEl) labelEl.textContent = '';
                if (markersEl) markersEl.innerHTML = '';
                if (tracerEl) {
                  tracerEl.setAttribute('cx', String(rect.x + rect.w));
                  tracerEl.setAttribute('cy', String(rect.y + rect.h / 2));
                }
                return;
              }

              // Autoscale
              const vScale = ignoreZeroForScale ? v.filter(n => n !== 0) : v;
              const yr = computeYRange(vScale.length ? vScale : v, yRangeCfg);

              // Map to points
              let pts = xMode === 'index'
                ? mapToRectIndex(v, rect, yr)
                : mapToRect(t, v, rect, msWindow, yr);

              if (stairStep) pts = toStairPoints(pts);

              // Extend edges
              if (pts.length) {
                const firstY = pts[0][1];
                const lastY = pts[pts.length - 1][1];
                if (extendLeft && pts[0][0] > rect.x) pts.unshift([rect.x, firstY]);
                if (extendRight && pts[pts.length - 1][0] < rect.x + rect.w) pts.push([rect.x + rect.w, lastY]);
              }

              // Sanitize
              pts = sanitizePoints(pts);
              if (!pts.length) {
                const y0 = rect.y + rect.h;
                pathEl.setAttribute('d', `M${rect.x},${y0} L${rect.x + rect.w},${y0}`);
                pathEl.setAttribute('data-cblcars-pending', 'true');   // ADD
                if (areaEl) areaEl.setAttribute('d', '');
                if (labelEl) labelEl.textContent = '';
                if (markersEl) markersEl.innerHTML = '';
                if (tracerEl) {
                  tracerEl.setAttribute('cx', String(rect.x + rect.w));
                  tracerEl.setAttribute('cy', String(rect.y + rect.h / 2));
                }
                return;
              }

              // When drawing real data: be sure to clear the pending flag
              if (smooth && pts.length > 1) {
                const dSmooth = generateSmoothPath(pts, { tension: smoothTension });
                pathEl.setAttribute('d', dSmooth);
                pathEl.removeAttribute('data-cblcars-pending');        // ADD
                if (areaEl) {
                  const firstPt = pts[0];
                  const lastPt = pts[pts.length - 1];
                  areaEl.setAttribute('d', areaPathFromSmooth(dSmooth, firstPt, lastPt, rect));
                }
              } else {
                const d = pathFromPoints(pts);
                pathEl.setAttribute('d', d);
                pathEl.removeAttribute('data-cblcars-pending');        // ADD
                if (areaEl) areaEl.setAttribute('d', areaPathFromPoints(pts, rect));
              }

              // Markers (last N points)
              if (markersEl && markerRadius > 0) {
                const limit = Math.min(pts.length, markersMax);
                let circles = '';
                for (let i = Math.max(0, pts.length - limit); i < pts.length; i++) {
                  const [cx, cy] = pts[i];
                  circles += `<circle cx="${cx}" cy="${cy}" r="${markerRadius}" fill="${markerFill}" />`;
                }
                markersEl.innerHTML = circles;
              }

              // Last value label
              if (labelEl) {
                const decimals = Number.isFinite(labelCfg.decimals) ? labelCfg.decimals : 1;
                const format = labelCfg.format || null;
                const offset = Array.isArray(labelCfg.offset) ? labelCfg.offset : [8, -8];
                const lastVal = v[v.length - 1];
                const lastPt = pts[pts.length - 1];
                const formatted = format
                  ? String(format).replace('{v}', Number(lastVal).toFixed(decimals))
                  : Number(lastVal).toFixed(decimals);
                labelEl.textContent = formatted;
                labelEl.setAttribute('x', String(lastPt[0] + (offset[0] ?? 0)));
                labelEl.setAttribute('y', String(lastPt[1] + (offset[1] ?? 0)));
              }

              // Tracer
              if (tracerEl) {
                const lastPt = pts[pts.length - 1];
                tracerEl.setAttribute('cx', String(lastPt[0]));
                tracerEl.setAttribute('cy', String(lastPt[1]));
              }
            };

            // First draw
            refresh();

            // Subscribe and draw on each tick
            if (pathEl.__cblcars_unsub_spark) {
              try { pathEl.__cblcars_unsub_spark(); } catch (_) {}
            }
            pathEl.__cblcars_unsub_spark = src.subscribe(() => refresh());

            // Extra safety: schedule two follow-up refreshes to catch any late preload/race
            setTimeout(refresh, 0);
            setTimeout(refresh, 100);
          } catch (e) {
            // no-op
          }
        });
      });

      return; // handled sparkline
    }

    // RIBBON (binary on/off lanes)
    const isRibbon = computed.type === 'ribbon';
    if (isRibbon) {
      // Resolve position and size with percent support
      const posPt = resolvePoint(computed.position, pointContext);
      const sizeAbs = resolveSize(computed.size, viewBox);
      if (!posPt || !sizeAbs) {
        svgOverlayManager.push(`Ribbon "${computed.id || `ribbon_${idx}`}" requires position (anchor or [x,y]) and size [w,h].`);
        return;
      }
      const rect = { x: Number(posPt[0]), y: Number(posPt[1]), w: Number(sizeAbs.w), h: Number(sizeAbs.h) };
      const elementId = computed.id || `ribbon_${idx}`;

      // Sources: source or sources[]
      const sourcesArr = Array.isArray(computed.sources) && computed.sources.length
        ? computed.sources
        : (computed.source ? [computed.source] : []);

      if (sourcesArr.length === 0) {
        svgOverlayManager.push(`Ribbon "${elementId}" requires "source" or "sources".`);
        return;
      }

      let msWindow = parseTimeWindowMs(computed.windowSeconds);
      if (!Number.isFinite(msWindow)) {
        const ws = typeof computed.windowSeconds === 'number' ? computed.windowSeconds : 3600;
        msWindow = ws * 1000;
      }
      msWindow = Math.max(1000, msWindow);

      const onColor = computed.on_color || 'var(--lcars-yellow)';
      const offColor = computed.off_color || null;
      const opacity = computed.opacity ?? 1;
      const rx = Number.isFinite(computed.rx) ? Number(computed.rx) : 0;
      const ry = Number.isFinite(computed.ry) ? Number(computed.ry) : rx;
      const threshold = Number.isFinite(computed.threshold) ? Number(computed.threshold) : 1;
      const laneGap = Math.max(0, Number(computed.lane_gap ?? 2));

      // Optional backdrop (OFF)
      if (offColor) {
        svgElements.push(
          `<rect id="${elementId}_backdrop" x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="${offColor}" opacity="${opacity}" rx="${rx}" ry="${ry}" />`
        );
      }

      // Container group for ON segments
      svgElements.push(`<g id="${elementId}" opacity="${opacity}"></g>`);

      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          try {
            if (window.cblcars?.data?.ensureSources && dataSources && Object.keys(dataSources).length) {
              await window.cblcars.data.ensureSources(dataSources, hass);
            }
            const rootEl = root;
            const groupEl = rootEl?.querySelector?.(`#${elementId}`);
            if (!groupEl) return;

            const laneCount = sourcesArr.length;
            const laneHeight = laneCount > 0 ? (rect.h - laneGap * (laneCount - 1)) / laneCount : rect.h;

            const refresh = () => {
              let html = '';
              for (let lane = 0; lane < laneCount; lane++) {
                const srcName = sourcesArr[lane];
                const src = window.cblcars?.data?.getSource?.(srcName);
                if (!src) continue;

                const slice = src.buffer.sliceSince ? src.buffer.sliceSince(msWindow) : sliceWindow(src.buffer, msWindow);
                const t = slice.t || [];
                const v = slice.v || [];
                if (!t.length) continue;

                const segs = buildOnSegments(t, v, msWindow, threshold);
                const yTop = rect.y + lane * (laneHeight + laneGap);
                for (const [ts0, ts1] of segs) {
                  const x0 = mapTimeToX(ts0, rect, msWindow);
                  const x1 = mapTimeToX(ts1, rect, msWindow);
                  const w = Math.max(0, x1 - x0);
                  if (w <= 0) continue;
                  html += `<rect x="${x0}" y="${yTop}" width="${w}" height="${laneHeight}" fill="${onColor}" rx="${rx}" ry="${ry}" />`;
                }
              }
              groupEl.innerHTML = html;
            };

            // Initial + live updates
            refresh();
            const unsubs = [];
            for (const srcName of sourcesArr) {
              const src = window.cblcars?.data?.getSource?.(srcName);
              if (src) unsubs.push(src.subscribe(() => refresh()));
            }
            if (groupEl.__cblcars_unsub_ribbon) {
              try { groupEl.__cblcars_unsub_ribbon.forEach(fn => fn && fn()); } catch (_) {}
            }
            groupEl.__cblcars_unsub_ribbon = unsubs;

            // Catch late history layout race
            setTimeout(refresh, 0);
            setTimeout(refresh, 100);
          } catch (_) {}
        });
      });

      return; // handled ribbon
    }





    // ... keep your existing line/text/free/timeline code paths below unchanged ...
    // (No changes shown here to keep this patch focused on the sparkline improvements)
  });

  svgElements.push(`<g id="${svgOverlayManager.containerId}"></g>`);
  const svgMarkup = `<svg viewBox="${viewBox.join(' ')}" width="100%" height="100%" style="pointer-events:none;">${svgElements.join('')}</svg>`;

  // Realtime bindings (unchanged)
  try {
    const realtimeOverlays = Array.isArray(overlays)
      ? overlays.filter(o => o && o.id && o.realtime && o.realtime.source && Array.isArray(o.realtime.bind))
      : [];
    if (realtimeOverlays.length > 0 && root) {
      if (window.cblcars?.data?.ensureSources) {
        window.cblcars.data.ensureSources(dataSources || {}, hass).catch(() => {});
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          for (const o of realtimeOverlays) {
            try {
              const el = root.querySelector(`#${o.id}`);
              const src = window.cblcars?.data?.getSource ? window.cblcars.data.getSource(o.realtime.source) : null;
              if (!el || !src) continue;
              const applyToDesc = o.realtime?.apply_to === 'descendants' || o.realtime?.descendants === true;
              const getNodes = () => (applyToDesc ? Array.from(el.querySelectorAll('*')) : [el]);
              const handler = (event) => {
                const v = event?.v;
                if (v === undefined) return;
                const setObj = {};
                for (const b of o.realtime.bind) {
                  let val = v;
                  if (b.map_range && window.cblcars?.anim?.utils?.mapRange) {
                    const { input_range, output_range } = b.map_range;
                    const mapper = window.cblcars.anim.utils.mapRange(
                      Number(input_range[0]), Number(input_range[1]),
                      Number(output_range[0]), Number(output_range[1])
                    );
                    val = mapper(v);
                    if (typeof b.round === 'number') val = Number(val.toFixed(b.round));
                  }
                  if (b.unit && typeof val === 'number') val = `${val}${b.unit}`;
                  const key = String(b.prop || '').replace(/_/g, '-');
                  setObj[key] = val;
                }
                try {
                  const nodes = getNodes();
                  if (window.cblcars?.anim?.utils?.set) {
                    nodes.forEach(n => window.cblcars.anim.utils.set(n, setObj));
                  } else {
                    nodes.forEach(n => {
                      for (const [k, valOut] of Object.entries(setObj)) {
                        if (k in n.style) n.style[k] = valOut;
                        else n.setAttribute(k, valOut);
                      }
                    });
                  }
                } catch (_) {}
              };
              if (el.__cblcars_unsub_rt) { try { el.__cblcars_unsub_rt(); } catch (_) {} }
              el.__cblcars_unsub_rt = src.subscribe(handler);
            } catch (_) {}
          }
        });
      });
    }
  } catch (_) {}

  // Merge standalone animations (unchanged)
  if (Array.isArray(animations)) {
    animations.forEach(anim => {
      let animCfg = { ...anim };
      if (!animCfg.type && animCfg.animation && animCfg.animation.type) {
        animCfg = { ...animCfg.animation, targets: animCfg.targets ?? animCfg.animation.targets, id: animCfg.id ?? animCfg.animation.id };
      }
      try {
        const overrides = resolveStatePreset(animCfg, presets, hass);
        if (overrides && typeof overrides === 'object') {
          Object.assign(animCfg, overrides);
        }
      } catch (e) {}
      animCfg = resolveAllDynamicValues(animCfg, hass);

      let targetsArr = [];
      if (animCfg.targets) {
        targetsArr = Array.isArray(animCfg.targets) ? animCfg.targets : [animCfg.targets];
      } else if (animCfg.id) {
        targetsArr = [`#${animCfg.id}`];
      }
      const filteredTargets = targetsArr.filter(sel => {
        if (typeof sel === 'string' && sel.startsWith('#')) {
          const id = sel.slice(1);
          return !timelineTargets.has(id);
        }
        return true;
      });
      if (filteredTargets.length > 0) {
        const finalTargets = filteredTargets.length === 1 ? filteredTargets[0] : filteredTargets;
        animationsToRun.push({ ...animCfg, targets: finalTargets, root });
      }
    });
  }

  return { svgMarkup, animationsToRun };
}
