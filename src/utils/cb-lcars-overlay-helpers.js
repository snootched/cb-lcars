import { drawLine, drawPolyline, drawText } from './cb-lcars-svg-helpers.js';
import { splitAttrsAndStyle } from './cb-lcars-style-helpers.js';
import { animateElement } from './cb-lcars-anim-helpers.js';

/**
 * Deeply merges source objects into a target object.
 * @param {object} target - The target object.
 * @param {...object} sources - The source objects.
 * @returns {object} The merged object.
 */
function deepMerge(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

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
    return func(...Object.values(context));
  } catch (e) {
    console.error('[CB-LCARS] Error evaluating template:', { template, context, error: e });
    return 'TEMPLATE_ERROR';
  }
}

/**
 * Resolves the final color from a color object based on entity state.
 * Used for simple state-based color changes when state_resolver is not active.
 * @param {object|string} colorObj - The color configuration object or a color string.
 * @param {string} state - The current state of the entity.
 * @returns {string} The resolved color string.
 */
function resolveColor(colorObj, state) {
  if (typeof colorObj !== 'object' || colorObj === null) {
    return colorObj; // It's already a color string or invalid
  }
  return colorObj[state] || colorObj.default || 'currentColor';
}

/**
 * Processes state_resolver rules to find a matching state and return its overrides.
 * @param {object} callout - The callout configuration.
 * @param {object} hass - The Home Assistant hass object.
 * @param {object} globalResolver - The global state_resolver config.
 * @returns {object|null} The matching state entry or null.
 */
function resolveCalloutState(callout, hass, globalResolver = {}) {
  const stateConfig = callout.state_resolver || globalResolver;
  if (!stateConfig.enabled || !Array.isArray(stateConfig.states) || !stateConfig.states.length) {
    return null;
  }

  for (const entry of stateConfig.states) {
    const entityId = entry.entity || callout.entity;
    if (!entityId) continue;

    const entity = hass.states[entityId];
    if (!entity) continue;

    const attribute = entry.attribute || callout.attribute;
    let value = attribute ? entity.attributes[attribute] : entity.state;

    if (value === undefined) continue;

    let numValue = Number(value);
    if (isNaN(numValue)) numValue = undefined;

    if (entry.equals !== undefined && value == entry.equals) return entry;
    if (entry.not_equals !== undefined && value != entry.not_equals) return entry;
    if (numValue !== undefined) {
      if (entry.from !== undefined && entry.to !== undefined && numValue >= entry.from && numValue <= entry.to) return entry;
      if (entry.from !== undefined && entry.to === undefined && numValue >= entry.from) return entry;
      if (entry.to !== undefined && entry.from === undefined && numValue <= entry.to) return entry;
    }
    if (Array.isArray(entry.in) && entry.in.includes(value)) return entry;
    if (Array.isArray(entry.not_in) && !entry.not_in.includes(value)) return entry;
    if (entry.regex && new RegExp(entry.regex).test(value)) return entry;
  }

  return null;
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


// Entry point for MSD overlays from custom button card
export function renderMsdOverlay({ overlays, anchors, styleLayers, hass, root = document, viewBox = [0, 0, 400, 200] }) {
  let svgElements = [];
  let cssAnimations = ''; // Store CSS keyframes
  const presets = styleLayers || {};
  const defaultPreset = presets.default || {};

  overlays.forEach((callout, idx) => {
    // 1. --- Configuration Merging ---
    let namedPresetName = callout.preset;
    const stateMatch = resolveCalloutState(callout, hass, presets.state_resolver);
    let stateOverrides = {};

    if (stateMatch) {
      if (stateMatch.preset) namedPresetName = stateMatch.preset;
      if (stateMatch.settings) stateOverrides = stateMatch.settings;
    }

    const namedPreset = (namedPresetName && presets[namedPresetName]) ? presets[namedPresetName] : {};

    // Merge order: default -> named preset -> callout -> state overrides
    const computed = deepMerge({}, defaultPreset, namedPreset, callout, stateOverrides);

    // Prepare context for template evaluation
    const entity = callout.entity && hass.states[callout.entity] ? hass.states[callout.entity] : null;
    const templateContext = { entity, hass, callout };

    // Visibility Check
    if (computed.visible !== undefined) {
      const isVisible = evaluateTemplate(computed.visible, templateContext);
      if (isVisible === false) {
        return; // Skip rendering this callout
      }
    }

    // Resolve simple state-based colors if a state_resolver did not match
    if (!stateMatch && entity) {
      if (computed.line?.color) {
        computed.line.color = resolveColor(computed.line.color, entity.state);
      }
      if (computed.text?.color) {
        computed.text.color = resolveColor(computed.text.color, entity.state);
      }
    }

    console.debug(`[CB-LCARS] Rendering MSD overlay ${idx}`, { callout, computed });

    // 2. --- Position & ID Resolution ---
    const anchorName = typeof computed.anchor === "string" ? computed.anchor : null;
    const textAnchorName = typeof computed.text?.position === "string" ? computed.text.position : null;

    const lineId = computed.line?.id || (anchorName ? `msd_line_${anchorName}` : `msd_line_${idx}`);
    const textId = computed.text?.id || (textAnchorName ? `msd_text_${textAnchorName}` : `msd_text_${idx}`);

    let anchorPos = anchorName && anchors[anchorName] ? anchors[anchorName] : (Array.isArray(computed.anchor) ? computed.anchor : null);
    let textPos = textAnchorName && anchors[textAnchorName] ? anchors[textAnchorName] : (Array.isArray(computed.text?.position) ? computed.text.position : null);

    if (!textPos) {
        console.warn(`[CB-LCARS] No valid text position for overlay ${idx}. Skipping.`);
        return;
    }

    // 3. --- Line & Text Smart Positioning ---
    let lineStartPos = [...textPos];
    if (computed.text) {
        const fontSize = parseFloat(computed.text.font_size) || 18;
        // 1. Evaluate the template *before* calculating width
        const textValue = evaluateTemplate(computed.text.value, templateContext);
        const textWidthMultiplier = computed.text.text_width_multiplier || 0.5;
        const textWidth = (textValue || '').length * fontSize * textWidthMultiplier;

        const align = computed.text.align || 'start';
        const lineAttach = computed.text.line_attach || 'center';

        let xOffset = 0;
        if (align === 'start' || align === 'left') {
            if (lineAttach === 'right' || lineAttach === 'end') xOffset = textWidth;
            else if (lineAttach === 'center' || lineAttach === 'middle') xOffset = textWidth / 2;
        } else if (align === 'end' || align === 'right') {
            if (lineAttach === 'left' || lineAttach === 'start') xOffset = -textWidth;
            else if (lineAttach === 'center' || lineAttach === 'middle') xOffset = -textWidth / 2;
        } else { // middle/center
            if (lineAttach === 'left' || lineAttach === 'start') xOffset = -textWidth / 2;
            else if (lineAttach === 'right' || lineAttach === 'end') xOffset = textWidth / 2;
        }

        // 2. Add explicit user offsets
        xOffset += computed.text.x_offset || 0;
        // The SVG <text> y attribute refers to the baseline. A small adjustment
        // moves the line start to the visual center of the text.
        const yOffset = (computed.text.y_offset || 0) - (fontSize / 3);

        lineStartPos[0] += xOffset;
        lineStartPos[1] += yOffset;
    }


    // 4. --- Line Rendering ---
    let lineSvg = '';
    if (computed.line && (anchorPos || (Array.isArray(computed.line.points) && computed.line.points.length > 1))) {
      const { attrs, style } = splitAttrsAndStyle(computed.line);

      // Check for explicit polyline points first
      if (Array.isArray(computed.line.points) && computed.line.points.length > 1) {
        const resolvedPoints = computed.line.points.map(p => {
            if (typeof p === 'string' && anchors[p]) return anchors[p];
            return p;
        }).filter(p => Array.isArray(p));

        if (resolvedPoints.length > 1) {
            if (computed.line.rounded) {
                const pathData = generateSmoothPath(resolvedPoints, { tension: computed.line.smooth_tension });
                const styleString = Object.entries(style).map(([k, v]) => `${k}:${v}`).join(';');
                const attrsString = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
                lineSvg = `<path id="${lineId}" d="${pathData}" ${attrsString} style="${styleString}" fill="none" />`;
            } else {
                lineSvg = drawPolyline({
                    points: resolvedPoints,
                    id: lineId,
                    attrs,
                    style,
                });
            }
        }

      } else if (anchorPos) {
        // Fallback to right-angle path if no points are defined but an anchor exists
        const pathData = generateRightAnglePath(lineStartPos, anchorPos, {
          radius: computed.line.corner_radius,
          cornerStyle: computed.line.corner_style,
        });

        // We build the path element manually since we have the `d` attribute
        const styleString = Object.entries(style).map(([k, v]) => `${k}:${v}`).join(';');
        const attrsString = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');

        lineSvg = `<path id="${lineId}" d="${pathData}" ${attrsString} style="${styleString}" fill="none" />`;
      }

      if (lineSvg) svgElements.push(lineSvg);
    }

    // 5. --- Text Rendering ---
    let textSvg = '';
    if (computed.text) {
      // Ensure 'fill' is set from 'color' for text elements and stroke is 'none'.
      if (computed.text.color && !computed.text.fill) {
        computed.text.fill = computed.text.color;
      }
      if (computed.text.stroke === undefined) {
        computed.text.stroke = 'none';
      }

      const { attrs, style } = splitAttrsAndStyle(computed.text);
      const textValue = evaluateTemplate(computed.text.value, templateContext);

      textSvg = drawText({
        x: textPos[0], y: textPos[1],
        text: textValue,
        id: textId,
        attrs,
        style,
      });
      if (textSvg) svgElements.push(textSvg);
    }

    // 6. --- Animation ---
    const lineAnim = computed.line?.animation || {};
    const textAnim = computed.text?.animation || {};

    if (lineAnim.type === 'march') {
      const dashArray = computed.line.stroke_dasharray;
      if (dashArray && dashArray !== 'none') {
        const dashLength = String(dashArray).split(/[\s,]+/).reduce((acc, val) => acc + parseFloat(val || 0), 0);
        const direction = (lineAnim.direction || 'forward').toLowerCase();
        const offset = direction === 'reverse' ? dashLength : -dashLength;
        const animName = `march-${lineId}`;
        const duration = typeof lineAnim.duration === 'number' ? `${lineAnim.duration}ms` : lineAnim.duration || '2s';
        const delay = typeof lineAnim.delay === 'number' ? `${lineAnim.delay}ms` : lineAnim.delay || '0s';
        cssAnimations += `
          @keyframes ${animName} { to { stroke-dashoffset: ${offset}; } }
          #${lineId} { animation: ${animName} ${duration} ${lineAnim.easing || 'linear'} ${delay} infinite; }
        `;
      }
    } else if (lineAnim.type === 'blink') {
      const animName = `blink-${lineId}`;
      const duration = typeof lineAnim.duration === 'number' ? `${lineAnim.duration}ms` : lineAnim.duration || '1.5s';
      const delay = typeof lineAnim.delay === 'number' ? `${lineAnim.delay}ms` : lineAnim.delay || '0s';
      const minOpacity = lineAnim.min_opacity ?? 0.3;
      const maxOpacity = lineAnim.max_opacity ?? 1;
      cssAnimations += `
        @keyframes ${animName} { 0%, 100% { opacity: ${maxOpacity}; } 50% { opacity: ${minOpacity}; } }
        #${lineId} { animation: ${animName} ${duration} ${lineAnim.easing || 'linear'} ${delay} infinite; }
      `;
    } else if (lineAnim.type) {
      animateElement({ ...lineAnim, targets: `#${lineId}`, root });
    }

    if (textAnim.type === 'blink') {
      const animName = `blink-${textId}`;
      const duration = typeof textAnim.duration === 'number' ? `${textAnim.duration}ms` : textAnim.duration || '1.5s';
      const delay = typeof textAnim.delay === 'number' ? `${textAnim.delay}ms` : textAnim.delay || '0s';
      const minOpacity = textAnim.min_opacity ?? 0.3;
      const maxOpacity = textAnim.max_opacity ?? 1;
      cssAnimations += `
        @keyframes ${animName} { 0%, 100% { opacity: ${maxOpacity}; } 50% { opacity: ${minOpacity}; } }
        #${textId} { animation: ${animName} ${duration} ${textAnim.easing || 'linear'} ${delay} infinite; }
      `;
    } else if (textAnim.type) {
      animateElement({ ...textAnim, targets: `#${textId}`, root });
    }
  });

  // Wrap all overlay elements in a single SVG container
  const styleBlock = cssAnimations ? `<style>${cssAnimations}</style>` : '';
  return `<svg viewBox="${viewBox.join(' ')}" width="100%" height="100%" style="pointer-events:none;">${styleBlock}${svgElements.join('')}</svg>`;
}