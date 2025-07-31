import { cblcarsLog } from './cb-lcars-logging.js';
import * as svgHelpers from './cb-lcars-svg-helpers.js';

export const animPresets = {
    draw: (params, element, options) => {
        Object.assign(params, {
            strokeDashoffset: (el) => {
                const pathLength = el.getTotalLength();
                el.style.strokeDasharray = pathLength;
                return [pathLength, 0];
            },
        });
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
    pulse: (params) => {
        Object.assign(params, {
            scale: [1, 1.1],
            opacity: [1, 0.7],
            direction: 'alternate',
            loop: true,
            easing: 'easeInOutSine',
        });
    },
    pulse_line: (params, element, options) => {
        const width = element.getAttribute('stroke-width') || params['stroke-width'] || 4;
        Object.assign(params, {
            'stroke-width': [parseFloat(width), parseFloat(width) * 1.5],
            direction: 'alternate',
            loop: true,
            easing: 'easeInOutSine',
            duration: options.duration ?? 1200
        });
    },
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
     * MotionPath animation preset.
     * Handles tracer and trail options.
     * @param {object} params - Anime.js animation params (will be mutated).
     * @param {Element} element - The target element to animate (should be the path).
     * @param {object} options - The original animation config (may include path_selector, tracer, trail, etc).
     */
    motionpath: async function (params, element, options) {
        const { path_selector, root = document, trail, tracer } = options;
        if (!path_selector) {
            cblcarsLog.error('[motionpath preset] Missing path_selector.', { options });
            return;
        }
        const pathElement = await window.cblcars.waitForElement(path_selector, root);
        if (!pathElement) {
            cblcarsLog.error('[motionpath preset] Could not find path element.', { path_selector });
            return;
        }

        // The preset is now called from within a scope.add() callback.
        // It should modify the `params` object or, in this case, create new animations.

        // Animate trail if requested
        if (trail) {
            try {
                const drawable = window.cblcars.animejs.svg.createDrawable(pathElement);
                const trailTarget = Array.isArray(drawable) ? drawable[0] : drawable;
                if (trailTarget instanceof SVGElement) {
                    const trailOptions = typeof trail === 'object' && trail !== null ? trail : {};
                    const animeConfig = {
                        targets: trailTarget,
                        draw: '0 1',
                        duration: trailOptions.duration ?? params.duration ?? 1000,
                        easing: trailOptions.easing ?? params.easing ?? 'easeInOutQuad',
                        loop: trailOptions.loop ?? params.loop,
                    };
                    if (trailOptions && Object.prototype.toString.call(trailOptions) === '[object Object]') {
                        Object.assign(animeConfig, trailOptions);
                    }
                    // This animation is created inside the scope.add() context, so it's automatically managed.
                    const { targets: trailTargets, ...trailVars } = animeConfig;
                    window.cblcars.anim.anime(trailTargets, trailVars);
                } else {
                    cblcarsLog.error('[motionpath preset] Trail target is not a valid SVGElement.', { trailTarget });
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
            const exclude = ['tracer', 'trail', 'path_selector', 'root', 'targets', 'type'];
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
     * CSS-based smooth marching dashed line, adapting the technique from cb-lcars-msd-orig.yaml
     * This creates a CSS animation and assigns it to the element instead of using anime.js animation
     * @param {object} params - AnimateJS params object (will be filled with dummy values)
     * @param {Element} element - DOM element to animate
     * @param {object} options - Configuration options
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

        // Apply stroke linecap if specified
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

    // Add more presets as needed...
};