import { cblcarsLog } from './cb-lcars-logging.js';
import * as svgHelpers from './cb-lcars-svg-helpers.js';
import { svgOverlayManager } from './cb-lcars-overlay-helpers.js';

export const animPresets = {
    /**
     * @preset draw
     * Animates the drawing of an SVG path.
     * @param {object} params - Anime.js v4 params object.
     * @param {Element} element - SVG path element.
     * @param {object} options - Animation config.
     */
    draw: (params, element, options = {}) => {
        // Use animejs v4 createDrawable for robust SVG path drawing
        const [drawable] = window.cblcars.animejs.svg.createDrawable(element);

        // Standard anime.js options
        const duration = params.duration ?? options.duration ?? 1200;
        const easing = params.easing ?? options.easing ?? 'easeInOutSine';
        const loop = params.loop ?? options.loop ?? false;
        const alternate = params.alternate ?? options.alternate ?? false;

        // Draw-specific config: prefer params.draw, then options.draw, then default
        const drawCfg = params.draw || options.draw || {};
        let drawValues;
        if (Array.isArray(drawCfg)) {
            drawValues = drawCfg;
        } else if (drawCfg && Array.isArray(drawCfg.values)) {
            drawValues = drawCfg.values;
        } else {
            drawValues = ['0 0', '0 1'];
        }

        // Set the anime.js params for draw animation
        Object.assign(params, {
            targets: drawable,
            draw: drawValues,
            duration,
            easing,
            loop,
            alternate
        });

        // Remove any conflicting opacity/stroke-width from params
        delete params.opacity;
        delete params['stroke-width'];
    },
    /* //stutters on loop with anime.js .. use css version for now
    march: (params, element, options) => {
        const dashArray = element.getAttribute('stroke-dasharray');
        if (!dashArray || dashArray === 'none') return;
        const patternLength = dashArray.split(/[\s,]+/).reduce((acc, len) => acc + parseFloat(len), 0);
        if (patternLength === 0) return;
        element.style.strokeDashoffset = '0';
        const endValue = params.direction === 'reverse' ? patternLength : -patternLength;
        Object.assign(params, {
            strokeDashoffset: [0, endValue],
        });
        if (params.loop === undefined) params.loop = true;
        if (params.easing === 'easeInOutQuad') params.easing = 'linear';
    },
    fade: (params) => {
        Object.assign(params, { opacity: [0, 1] });
    },
    */
    /**
     * @preset pulse
     * Pulses scale and opacity for a "breathing" effect (text), or stroke-width and opacity for lines.
     * @param {object} params
     * @param {Element} element
     * @param {object} options
     */
    pulse: (params, element, options = {}) => {
        cblcarsLog.debug('[pulse preset] Before mutation:', { params, element, options });

        // Prefer pulse config from params.pulse, then options.pulse, then options, then defaults
        const pulseCfg = params.pulse || options.pulse || options || {};
        const maxScale = pulseCfg.max_scale !== undefined
            ? pulseCfg.max_scale
            : (element.tagName === 'text' || element.tagName === 'TEXT' ? 1.1 : 1.5);
        const minOpacity = pulseCfg.min_opacity !== undefined
            ? pulseCfg.min_opacity
            : 0.7;

        // Remove any previous stroke-width/opacity assignments to avoid conflicts
        delete params['stroke-width'];
        delete params.opacity;

        // Generic anime.js options from main animation key
        const duration = params.duration ?? options.duration ?? 1200;
        const easing = params.easing ?? options.easing ?? 'easeInOutSine';
        const loop = params.loop ?? options.loop ?? true;
        const alternate = params.alternate ?? options.alternate ?? true;

        if (element.tagName === 'text' || element.tagName === 'TEXT') {
            Object.assign(params, {
                scale: [1, maxScale],
                opacity: [1, minOpacity],
                easing,
                duration,
                loop,
                alternate
            });
            element.style.transformOrigin = 'center';
            element.style.transformBox = 'fill-box';
            cblcarsLog.debug('[pulse preset] Set transformOrigin/transformBox for text:', {
                id: element.id,
                style: element.style.cssText
            });
        } else if (element.hasAttribute('stroke-width')) {
            // Pulse lines: animate stroke-width and opacity
            const width = parseFloat(element.getAttribute('stroke-width')) || 4;
            Object.assign(params, {
                'stroke-width': [width, width * maxScale],
                opacity: [1, minOpacity],
                easing,
                duration,
                loop,
                alternate
            });
            cblcarsLog.debug('[pulse preset] Pulsing line:', {
                id: element.id,
                strokeWidth: width,
                maxScale
            });
        } else {
            // Fallback: just animate opacity
            Object.assign(params, {
                opacity: [1, minOpacity],
                easing,
                duration,
                loop,
                alternate
            });
        }
        cblcarsLog.debug('[pulse preset] After mutation:', { params, element });
    },
    /**
     * @preset blink
     * Blinks opacity between two values.
     * @param {object} params
     * @param {Element} element
     * @param {object} options
     */
    blink: (params, element, options) => {
        Object.assign(params, {
            opacity: [options.max_opacity ?? 1, options.min_opacity ?? 0.3],
            alternate: true,
            loop: true,
            easing: options.easing || 'linear', // or 'easeInOutSine'
            duration: options.duration ?? 1200
        });
    },
    /**
     * @preset motionpath
     * Animates an element along a path, with optional tracer and trail.
     * @param {object} params
     * @param {Element} element
     * @param {object} options
     */
    motionpath: async function (params, element, options) {
        // Default path_selector to element's own selector if not provided
        let path_selector = options.path_selector;
        let root = options.root ?? document;
        const trail = options.trail;
        const tracer = options.tracer;

        // --- Require tracer for motionpath ---
        if (!tracer) {
            const msg = '[motionpath] tracer is required';
            cblcarsLog.warn(msg, { element });
            svgOverlayManager.push(msg);
            params.targets = null;
            return;
        }

        let pathElement;
        if (path_selector) {
            pathElement = await window.cblcars.waitForElement(path_selector, root);
        } else {
            pathElement = element;
        }
        if (!pathElement) {
            const errorMsg = `Motionpath: path not found for selector "${path_selector}"`;
            cblcarsLog.error(errorMsg);
            svgOverlayManager.push(errorMsg);
            return;
        }

        // Animate trail if requested
        if (trail) {
            try {
                // Determine trail mode
                const trailOptions = (typeof trail === 'object' && trail !== null)
                    ? trail
                    : {
                        stroke: 'var(--lcars-yellow)',
                        // Use stroke-width from the computed options, then the element, then default
                        'stroke-width': options['stroke-width'] ?? pathElement.getAttribute('stroke-width') ?? 4,
                        duration: params.duration ?? 1000,
                        easing: params.easing ?? 'easeInOutQuad',
                        loop: params.loop,
                        mode: 'overlay'
                    };
                const mode = trailOptions.mode || 'overlay';

                let trailPath;
                if (pathElement.cloneNode) {
                    trailPath = pathElement.cloneNode(true);
                    trailPath.removeAttribute('id');
                    trailPath.id = (pathElement.id ? pathElement.id + '_trail' : 'msd_trail_' + Math.random().toString(36).slice(2));

                    // Set trail color and stroke-width
                    if (trailOptions.stroke) trailPath.setAttribute('stroke', trailOptions.stroke);
                    // Use the stroke-width from the original path if not specified in trail options
                    const trailStrokeWidth = trailOptions['stroke-width'] ?? options['stroke-width'] ?? pathElement.getAttribute('stroke-width');
                    if (trailStrokeWidth) trailPath.setAttribute('stroke-width', trailStrokeWidth);
                    if (trailOptions.opacity !== undefined) trailPath.setAttribute('opacity', trailOptions.opacity);

                    // Insert trail path after the original
                    pathElement.parentNode.insertBefore(trailPath, pathElement.nextSibling);

                    // If mode is 'single', hide the base line
                    if (mode === 'single') {
                        pathElement.setAttribute('opacity', '0');
                        pathElement.setAttribute('stroke', 'none');
                    }

                    // Animate the trail path only
                    const drawable = window.cblcars.animejs.svg.createDrawable(trailPath);
                    const trailTarget = Array.isArray(drawable) ? drawable[0] : drawable;
                    const animeConfig = {
                        targets: trailTarget,
                        draw: '0 1',
                        duration: trailOptions.duration ?? params.duration ?? 1000,
                        easing: trailOptions.easing ?? params.easing ?? 'easeInOutQuad',
                        loop: trailOptions.loop ?? params.loop,
                    };
                    Object.assign(animeConfig, trailOptions);
                    const { targets: trailTargets, ...trailVars } = animeConfig;
                    window.cblcars.anim.anime(trailTargets, trailVars);
                } else {
                    cblcarsLog.error('[motionpath preset] Could not clone path for trail.', { pathElement });
                }
            } catch (trailerError) {
                cblcarsLog.error('[motionpath preset] Failed to animate trail:', { trailerError });
            }
        }

        // --- Tracer logic ---
        if (tracer) {
            // Use svgHelpers to create the tracer SVG element
            // Use the path's ID as a base for tracer ID if possible
            let baseId = pathElement.id || 'msd_tracer';
            const tracerId = tracer.id || `${baseId}_tracer`;
            let tracerEl;
            if (tracer.shape === 'rect') {
                tracerEl = svgHelpers.drawRect({
                    x: -(tracer.width || 8) / 2,
                    y: -(tracer.height || 8) / 2,
                    width: tracer.width || 8,
                    height: tracer.height || 8,
                    id: tracerId,
                    attrs: { fill: tracer.fill || 'var(--lcars-orange)' },
                    style: tracer.style || {},
                });
            } else {
                tracerEl = svgHelpers.drawCircle({
                    cx: 0,
                    cy: 0,
                    r: tracer.r || 4,
                    id: tracerId,
                    attrs: { fill: tracer.fill || 'var(--lcars-orange)' },
                    style: tracer.style || {},
                });
            }
            // tracerEl is a string, so parse it to an SVG element
            const temp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            temp.innerHTML = tracerEl;
            const tracerNode = temp.firstElementChild;

            // Find the top-level SVG container to append the tracer
            let svgRoot = pathElement.ownerSVGElement;
            if (!svgRoot) {
                svgRoot = pathElement.closest('svg');
            }
            if (svgRoot) {
                svgRoot.appendChild(tracerNode);
                cblcarsLog.debug('[motionpath preset] Tracer SVG appended', { tracerId, svgRoot });
            } else {
                pathElement.parentNode.appendChild(tracerNode);
                cblcarsLog.warn('[motionpath preset] Could not find SVG root, appended tracer to path parent.', { tracerId });
            }

            // Prepare animation options for tracer
            const { translateX, translateY, rotate } = window.cblcars.animejs.svg.createMotionPath(pathElement);

            // Merge all standard anime.js options (from params and options), but exclude tracer/trail/path_selector/root/targets/type
            // and any line-specific styling that shouldn't apply to the tracer.
            const exclude = [
                'tracer', 'trail', 'path_selector', 'root', 'targets', 'type', 'animation',
                'stroke', 'stroke-width', 'corner_style', 'corner_radius', 'waypoints',
                'steps', 'rounded', 'smooth', 'smooth_tension', 'id'
            ];
            const merged = {};
            for (const k of Object.keys(params)) {
                if (!exclude.includes(k)) merged[k] = params[k];
            }
            for (const k of Object.keys(options)) {
                if (!exclude.includes(k)) merged[k] = options[k];
            }

            cblcarsLog.debug('[motionpath preset] Animating tracer', { tracerId, merged });
            window.cblcars.anim.anime(tracerNode, {
                ...merged,
                translateX,
                translateY,
                rotate,
            });
            // Prevent the original animation from running on the path itself
            params.targets = null;
            return;
        }

        // If no tracer, animate the line itself (legacy/fallback)
        const { translateX, translateY, rotate } = window.cblcars.animejs.svg.createMotionPath(pathElement);
        Object.assign(params, { translateX, translateY, rotate });
    },

    /* //stutters on loop with anime.js .. use css version for now
    march_smooth: (params, element, options = {}) => {
        // Prefer stroke_dasharray from params, then options, then default
        let dashArray = params.stroke_dasharray ?? options.stroke_dasharray ?? [25, 15];
        if (!Array.isArray(dashArray) || dashArray.length < 2) {
            dashArray = [25, 15];
        }
        const [dashLength, gapLength] = dashArray;

        // Set the stroke-dasharray for the dashed pattern
        element.style.strokeDasharray = `${dashLength} ${gapLength}`;
        element.style.strokeDashoffset = 0;

        // Animate over many cycles for seamless loop
        const cycleLength = dashLength + gapLength;
        const numberOfCycles = params.numberOfCycles ?? options.numberOfCycles ?? 500;

        // If duration is provided, use it as total duration; else fallback to durationPerCycle * numberOfCycles
        let totalAnimationDuration;
        if (typeof params.duration === 'number') {
            totalAnimationDuration = params.duration;
        } else if (typeof options.duration === 'number') {
            totalAnimationDuration = options.duration;
        } else {
            const durationPerCycle = params.durationPerCycle ?? options.durationPerCycle ?? 2000;
            totalAnimationDuration = durationPerCycle * numberOfCycles;
        }

        // Direction: use params.reversed, else options.reversed, else params.direction/options.direction
        let reversed = params.reversed ?? options.reversed ?? false;
        let direction = reversed ? 'reverse' : (params.direction ?? options.direction ?? 'normal');

        // Animate offset over many cycles
        const totalOffsetTarget = direction === 'reverse'
            ? cycleLength * numberOfCycles
            : -cycleLength * numberOfCycles;

        Object.assign(params, {
            strokeDashoffset: [0, totalOffsetTarget],
            easing: params.easing ?? 'linear',
            duration: totalAnimationDuration,
            loop: true,
            loopDelay: 0,
            direction,
            playbackRate: params.playbackRate ?? options.playbackRate ?? 1
        });
    },
    */
    /**
     * @preset march
     * CSS-based marching dashed line animation.
     * @param {object} params
     * @param {Element} element
     * @param {object} options
     */
    march: (params, element, options = {}) => {
        // Get dash pattern from stroke_dasharray
        let dashArray = params.stroke_dasharray ?? options.stroke_dasharray ?? [25, 15];
        if (!Array.isArray(dashArray) || dashArray.length < 2) {
            dashArray = [25, 15];
        }
        const [dashLength, gapLength] = dashArray;

        // Set the stroke-dasharray for the dashed pattern
        element.style.strokeDasharray = `${dashLength} ${gapLength}`;
        element.style.strokeDashoffset = 0;

        // Apply ststroberoke linecap if specified
        const linecap = params.stroke_linecap ?? options.stroke_linecap;
        if (linecap) {
            element.style.strokeLinecap = linecap;
        }

        // Calculate cycle length (sum of dash and gap)
        const cycleLength = dashLength + gapLength;

        // Get animation duration, default to 2s if not specified
        let duration = params.duration ?? options.duration ?? 2000;

        // Convert to seconds for CSS
        const durationSec = duration / 1000;

        // Get direction
        let reversed = params.reversed ?? options.reversed ?? false;

        // Create unique animation name using element id or a random string
        const animId = element.id || `march_${Math.random().toString(36).substring(2, 9)}`;
        element.dataset.marchAnimId = animId;

        // Direction: offset moves negative for forward, positive for reverse
        const offsetTarget = reversed ? cycleLength : -cycleLength;

        // Handle loop parameter (like anime.js)
        // - true or undefined: infinite loop (CSS: infinite)
        // - false or 0: no loop (CSS: 1)
        // - number > 0: specific iteration count
        let loopValue = params.loop ?? options.loop ?? true;
        const iterationCount = loopValue === true ? 'infinite' :
                              (loopValue === false || loopValue === 0) ? '1' :
                              typeof loopValue === 'number' ? Math.max(1, loopValue) : 'infinite';

        // Find the appropriate document to inject styles into
        const targetDoc = element.getRootNode();
        const isInShadowDOM = targetDoc !== document;

        // Apply animation directly to the element via inline style
        // This avoids Shadow DOM style isolation issues
        const animationName = `march_${animId}`;
        const keyframesStr = `@keyframes ${animationName} { to { stroke-dashoffset: ${offsetTarget}px; } }`;

        // Apply animation directly to the element
        const playbackRate = params.playbackRate ?? options.playbackRate ?? 1;
        const effectiveDuration = `${durationSec / playbackRate}s`;

        // Set inline styles directly on the element - more reliable across shadow DOM boundaries
        element.style.animation = `${animationName} ${effectiveDuration} linear ${iterationCount}`;

        // Create keyframes for the animation and inject them
        if (isInShadowDOM && targetDoc.adoptedStyleSheets) {
            // Modern Shadow DOM with Constructable Stylesheets
            try {
                let styleSheet = Array.from(targetDoc.adoptedStyleSheets)
                    .find(sheet => sheet.marchAnimations);

                if (!styleSheet) {
                    styleSheet = new CSSStyleSheet();
                    styleSheet.marchAnimations = true;
                    targetDoc.adoptedStyleSheets = [...targetDoc.adoptedStyleSheets, styleSheet];
                }

                styleSheet.insertRule(keyframesStr, styleSheet.cssRules.length);
            } catch (e) {
                cblcarsLog.error('Failed to add CSS animation to Shadow DOM:', e);
                fallbackStyleInjection();
            }
        } else {
            // Fallback: add <style> element to document/shadowRoot
            fallbackStyleInjection();
        }

        function fallbackStyleInjection() {
            const styleId = 'march-smooth-css-animations';
            let styleEl = targetDoc.getElementById ? targetDoc.getElementById(styleId) : null;

            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = styleId;
                const target = isInShadowDOM ? targetDoc : document.head;
                target.appendChild(styleEl);
            }

            if (!styleEl.textContent.includes(animationName)) {
                styleEl.textContent += keyframesStr;
            }
        }

        // Fill params with dummy values so anime.js doesn't override our CSS animation
        Object.assign(params, {
            _cssAnimation: true, // flag to indicate we're using CSS animation
            duration: 1,
            loop: false,
            autoplay: false
        });
    },

    /**
     * @preset glow
     * Animates stroke color and drop-shadow for a glowing effect.
     * @param {object} params
     * @param {Element} element
     * @param {object} options
     */
    glow: (params, element, options = {}) => {
        cblcarsLog.debug('[glow preset] Before mutation:', { params, element, options });

        // Configurable values with defaults
        const glowCfg = options.glow || {};
        const color = glowCfg.color || options.color || 'var(--picard-light-blue)';
        const intensity = glowCfg.intensity ?? options.intensity ?? 0.8;
        const blurMin = glowCfg.blur_min ?? 0;
        const blurMax = glowCfg.blur_max ?? 12;
        const opacityMin = glowCfg.opacity_min ?? 0.4;
        const opacityMax = glowCfg.opacity_max ?? intensity;
        const duration = options.duration ?? glowCfg.duration ?? 900;
        const easing = options.easing ?? glowCfg.easing ?? 'easeInOutSine';
        const loop = options.loop ?? glowCfg.loop ?? true;
        const alternate = options.alternate ?? glowCfg.alternate ?? true;

        const glowState = { blur: blurMin, opacity: opacityMin };

        Object.assign(params, {
            targets: glowState,
            blur: [blurMin, blurMax, blurMin],
            opacity: [opacityMin, opacityMax, opacityMin],
            duration,
            easing,
            loop,
            alternate,
            onUpdate() {
                if (element.tagName === 'text' || element.tagName === 'TEXT') {
                    // For text, animate both blur and opacity
                    element.style.filter = `drop-shadow(0 0 ${glowState.blur}px ${color}) opacity(${glowState.opacity})`;
                } else {
                    // For lines, only animate blur, do not affect element opacity
                    element.style.filter = `drop-shadow(0 0 ${glowState.blur}px ${color})`;
                }
            }
        });
        // Remove fill/stroke animation
        delete params.fill;
        delete params.stroke;
        element.style.transformOrigin = 'center';
        element.style.transformBox = 'fill-box';
        cblcarsLog.debug('[glow preset] Animating drop-shadow:', { color, intensity, blurMin, blurMax, opacityMin, opacityMax, duration, easing, loop, alternate });

        cblcarsLog.debug('[glow preset] After mutation:', { params, element });
    },

    /**
     * @preset shimmer
     * Animates fill and opacity for a shimmering effect.
     * @param {object} params
     * @param {Element} element
     * @param {object} options
     */
    shimmer: (params, element, options = {}) => {
        const color = options.color || 'var(--lcars-yellow)';
        Object.assign(params, {
            opacity: [1, 0.5, 1],
            fill: [element.getAttribute('fill') || color, color],
            alternate: true,
            loop: true,
            easing: 'easeInOutSine',
            duration: options.duration ?? 1200
        });
    },

    /**
     * @preset strobe
     * Rapidly toggles opacity for a strobe effect.
     * @param {object} params
     * @param {Element} element
     * @param {object} options
     */
    strobe: (params, element, options = {}) => {
        Object.assign(params, {
            opacity: [1, 0.1],
            alternate: true,
            loop: true,
            easing: 'steps(2, end)',
            duration: options.duration ?? 400
        });
    },

    /**
     * @preset cascade
     * Staggers opacity animation for multiple elements.
     * @param {object} params
     * @param {Element} element
     * @param {object} options
     */
    cascade: (params, element, options = {}) => {
        Object.assign(params, {
            opacity: [0, 1],
            delay: window.cblcars.animejs.stagger(options.stagger ?? 100),
            easing: 'easeOutQuad',
            duration: options.duration ?? 800
        });
    },

    /**
     * @preset ripple
     * Animates scale and opacity for a ripple effect.
     * @param {object} params
     * @param {Element} element
     * @param {object} options
     */
    ripple: (params, element, options = {}) => {
        Object.assign(params, {
            scale: [1, options.max_scale ?? 2, 1],
            opacity: [1, 0.3, 1],
            alternate: true,
            loop: true,
            easing: 'easeInOutSine',
            duration: options.duration ?? 1200
        });
    },

    /**
     * @preset flicker
     * Randomizes opacity for a flicker effect.
     * @param {object} params
     * @param {Element} element
     * @param {object} options
     */
    flicker: (params, element, options = {}) => {
        Object.assign(params, {
            opacity: [
                1,
                0.7 + Math.random() * 0.3,
                0.4 + Math.random() * 0.3,
                1
            ],
            //alternate: true,
            alternate: false,
            loop: true,
            easing: 'steps(4, end)',
            duration: options.duration ?? 600
        });
    },

    /**
     * @preset set
     * Directly sets properties/attributes/styles on the element.
     * @param {object} params
     * @param {Element} element
     * @param {object} options
     */
    set: (params, element, options = {}) => {
        const ignoreKeys = ['type', 'targets', 'root', 'animation', 'id', 'offset'];
        const allParams = { ...params, ...options };

        Object.entries(allParams).forEach(([key, value]) => {
            if (ignoreKeys.includes(key) || value === undefined) return;

            try {
                // Prioritize setting style properties, as they override attributes.
                // This is crucial for properties like 'fill' which can be in an inline style attribute.
                if (key in element.style) {
                    element.style[key] = value;
                } else {
                    // Fallback to setting as an attribute for other properties (e.g., 'd' for paths).
                    element.setAttribute(key, value);
                }
            } catch (e) {
                cblcarsLog.warn(`[set preset] Could not set property '${key}' on element`, { element, e });
            }
        });
        // Prevent anime.js from running an animation
        params._cssAnimation = true;
        params.targets = null;
    },

    // Add more presets as needed...
};