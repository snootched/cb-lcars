import { cblcarsLog } from './cb-lcars-logging.js';
import * as svgHelpers from './cb-lcars-svg-helpers.js';
import { svgOverlayManager } from './cb-lcars-overlay-helpers.js';

/**
 * Utility: test if a path 'd' string has drawable geometry beyond a single move.
 */
function hasUsablePathD(d) {
  if (!d || typeof d !== 'string') return false;
  // Must contain at least one command beyond the initial M (e.g., L,C,Q,A,Z)
  return /[MLCQAHVZmlcqahvz].*[MLCQAHVZmlcqahvz]/.test(d) || /[LCAHVQZlca hvqz]/.test(d);
}

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

    fade: (params, element, options = {}) => {
    const duration = params.duration ?? options.duration ?? 1000;
    const easing = params.easing ?? options.easing ?? 'linear';
    const loop = params.loop ?? options.loop ?? false;
    const alternate = params.alternate ?? options.alternate ?? false;
    Object.assign(params, {
        opacity: [0, 1],
        duration,
        easing,
        loop,
        alternate
    });
    },

    /**
     * @preset motionpath
     * Animates a tracer along a path, with optional trail.
     * Contract:
     *  - tracer is required; if missing, the preset aborts and surfaces an overlay error.
     *  - Waits until the target <path> has a valid 'd' before building transforms.
     *  - If the path has data-cblcars-pending="true" (sparkline baseline), trail is hidden until real data arrives.
     *  - Listens for 'd' and 'data-cblcars-pending' changes, re-binding tracer and syncing trail as the path updates.
     *
     * Anime.js v4 notes:
     *  - Use window.cblcars.anim.anime(targets, vars)
     *  - Use window.cblcars.animejs.svg.createMotionPath(pathEl) → { translateX, translateY, rotate }
     *  - Use window.cblcars.animejs.svg.createDrawable(pathEl) for draw animations
     *
     * Required external helpers (already in this project):
     *  - window.cblcars.waitForElement(selector, root)
     *  - svgOverlayManager.push(msg) for user-visible overlay errors
     */


    /**
     * @preset motionpath  (UPDATED MOTIONPATH PRESET – Option D)
     * Robust wait for usable path + pending flag, tracer & trail support, auto rebind.
     */
    motionpath: async function motionpathPreset(params, element, options = {}) {
        try {
            const root = options.root ?? document;

            // Provide waitForElement alias if missing
            if (!window.cblcars.waitForElement && window.cblcars.anim?.waitForElement) {
                window.cblcars.waitForElement = window.cblcars.anim.waitForElement;
            }

            const tracerCfg = options.tracer;
            if (!tracerCfg) {
                const msg = '[motionpath] tracer is required';
                cblcarsLog.warn(msg, { element });
                svgOverlayManager.push(msg);
                params.targets = null;
                return;
            }

            const pathSelector = options.path_selector;
            let pathEl = pathSelector
                ? (await window.cblcars.waitForElement(pathSelector, root).catch(() => null))
                : element;

            if (!pathEl) {
                const errorMsg = `Motionpath: path not found for selector "${pathSelector || '(self)'}"`;
                cblcarsLog.error(errorMsg);
                svgOverlayManager.push(errorMsg);
                params.targets = null;
                return;
            }
            if (String(pathEl.tagName).toLowerCase() !== 'path') {
                const msg = '[motionpath] Target is not an SVG <path>';
                cblcarsLog.warn(msg, { id: pathEl.id });
                svgOverlayManager.push(msg);
                params.targets = null;
                return;
            }

            const baseId = pathEl.id || 'msd_path';

            // Helper: determine if path 'd' is actually usable (not just single move or zero length)
            const hasUsablePathD = (p) => {
                if (!p || typeof p !== 'string') return false;
                // Require at least one command beyond initial M and a second coordinate
                // Simpler: must contain an 'L','C','Q','A','H','V','Z' (besides the opening M)
                return /[LCHQAVZlchqavz]/.test(p);
            };
            const pathLengthOk = (el) => {
                try {
                    return el.getTotalLength() > 0.5;
                } catch (_) {
                    return false;
                }
            };
            const isPending = (el) => el?.getAttribute('data-cblcars-pending') === 'true';

            const cleanupArtifacts = () => {
                const svgRoot = pathEl.ownerSVGElement || pathEl.closest('svg') || root;
                if (!svgRoot) return;
                const priorTracer = svgRoot.querySelector(`#${baseId}_tracer[data-cblcars-owned="motionpath"]`);
                const priorTrail = svgRoot.querySelector(`#${baseId}_trail[data-cblcars-owned="motionpath"]`);
                if (priorTracer?.parentNode) priorTracer.parentNode.removeChild(priorTracer);
                if (priorTrail?.parentNode) priorTrail.parentNode.removeChild(priorTrail);
            };

            let trailPath = null;
            let tracerNode = null;
            let pathMutationObserver = null;
            let alive = true;

            // Build trail (draw effect) if configured
            const buildTrail = () => {
                const trailOpt = options.trail;
                if (!trailOpt) return;
                try {
                    trailPath = pathEl.cloneNode(true);
                    trailPath.id = `${baseId}_trail`;
                    trailPath.setAttribute('data-cblcars-owned', 'motionpath');
                    const stroke = trailOpt.stroke || pathEl.getAttribute('stroke') || 'var(--lcars-yellow)';
                    const sw = trailOpt['stroke-width']
                        ?? options['stroke-width']
                        ?? pathEl.getAttribute('stroke-width')
                        ?? 4;
                    trailPath.setAttribute('stroke', stroke);
                    trailPath.setAttribute('stroke-width', sw);
                    if (trailOpt.opacity !== undefined) trailPath.setAttribute('opacity', trailOpt.opacity);

                    const mode = trailOpt.mode || 'overlay';
                    if (mode === 'single') {
                        pathEl.setAttribute('opacity', '0');
                        pathEl.setAttribute('stroke', 'none');
                    }
                    if (isPending(pathEl)) {
                        trailPath.setAttribute('visibility', 'hidden');
                    }

                    pathEl.parentNode.insertBefore(trailPath, pathEl.nextSibling);

                    const [drawable] = window.cblcars.animejs.svg.createDrawable(trailPath);
                    const trailVars = {
                        draw: '0 1',
                        duration: trailOpt.duration ?? params.duration ?? 1000,
                        easing: trailOpt.easing ?? params.easing ?? 'linear',
                        loop: trailOpt.loop ?? params.loop ?? true
                    };
                    window.cblcars.anim.anime(drawable, trailVars);
                } catch (e) {
                    cblcarsLog.error('[motionpath] Trail setup failed:', e);
                }
            };

            // Build tracer node (circle or rect)
            const buildTracer = () => {
                let tid = tracerCfg.id || `${baseId}_tracer`;
                const svgRoot = pathEl.ownerSVGElement || pathEl.closest('svg') || pathEl.parentNode;
                const existing = svgRoot ? svgRoot.getElementById?.(tid) : null;
                if (existing && existing.getAttribute('data-cblcars-owned') !== 'motionpath') {
                    tid = `${tid}_mptrc`;
                }

                let tracerMarkup;
                if (tracerCfg.shape === 'rect') {
                    tracerMarkup = svgHelpers.drawRect({
                        x: -((tracerCfg.width || 8) / 2),
                        y: -((tracerCfg.height || 8) / 2),
                        width: tracerCfg.width || 8,
                        height: tracerCfg.height || 8,
                        id: tid,
                        attrs: { fill: tracerCfg.fill || 'var(--lcars-orange)' },
                        style: tracerCfg.style || {}
                    });
                } else {
                    tracerMarkup = svgHelpers.drawCircle({
                        cx: 0,
                        cy: 0,
                        r: tracerCfg.r || 4,
                        id: tid,
                        attrs: { fill: tracerCfg.fill || 'var(--lcars-orange)' },
                        style: tracerCfg.style || {}
                    });
                }
                const temp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                temp.innerHTML = tracerMarkup;
                tracerNode = temp.firstElementChild;
                tracerNode.setAttribute('data-cblcars-owned', 'motionpath');
                (svgRoot || pathEl.parentNode).appendChild(tracerNode);
            };

            const bindTracerAnimation = () => {
                if (!tracerNode || !pathEl) return;
                const { translateX, translateY, rotate } = window.cblcars.animejs.svg.createMotionPath(pathEl);

                const exclude = new Set([
                    'tracer', 'trail', 'path_selector', 'root', 'targets', 'type', 'animation',
                    'stroke', 'stroke-width', 'corner_style', 'corner_radius', 'waypoints',
                    'steps', 'rounded', 'smooth', 'smooth_tension', 'id'
                ]);
                const merged = {};
                Object.entries({ ...params, ...options }).forEach(([k, v]) => {
                    if (!exclude.has(k)) merged[k] = v;
                });

                try {
                    if (tracerNode.__cblcars_motion && typeof tracerNode.__cblcars_motion.pause === 'function') {
                        tracerNode.__cblcars_motion.pause();
                    }
                } catch (_) {}

                tracerNode.__cblcars_motion = window.cblcars.anim.anime(tracerNode, {
                    ...merged,
                    translateX,
                    translateY,
                    rotate
                });
            };

            const rebindAll = (reason = '') => {
                try {
                    if (!hasUsablePathD(pathEl.getAttribute('d')) || !pathLengthOk(pathEl)) {
                        return;
                    }
                    if (trailPath) {
                        trailPath.setAttribute('d', pathEl.getAttribute('d') || '');
                        if (isPending(pathEl)) {
                            trailPath.setAttribute('visibility', 'hidden');
                        } else {
                            trailPath.removeAttribute('visibility');
                        }
                    }
                    bindTracerAnimation();
                } catch (e) {
                    cblcarsLog.warn('[motionpath] rebind failed', { reason, e });
                }
            };

            const initArtifacts = () => {
                buildTrail();
                buildTracer();
                rebindAll('initial');
            };

            // Robust wait logic
            const waitMaxMs = Number.isFinite(options.wait_max_ms) ? options.wait_max_ms : 12000;
            const pollInterval = 120;
            const startTime = performance.now();

            const waitForReady = () => new Promise((resolve) => {
                const tick = () => {
                    // If path replaced externally, bail (outer loop handles reattach)
                    if (!alive) return resolve(false);

                    const d = pathEl.getAttribute('d') || '';
                    const pending = isPending(pathEl);
                    const usable = hasUsablePathD(d) && pathLengthOk(pathEl);

                    if (!pending && usable) return resolve(true);

                    // Only count timeout time AFTER pending cleared
                    if (!pending && (performance.now() - startTime) >= waitMaxMs) {
                        return resolve(false);
                    }
                    setTimeout(tick, pollInterval);
                };
                tick();
            });

            // Initial cleanup & wait
            cleanupArtifacts();
            const ready = await waitForReady();

            if (!ready) {
                const msg = `[motionpath] Timed out waiting for usable path geometry (id=${pathEl.id})`;
                cblcarsLog.warn(msg);
                svgOverlayManager.push(msg);
                params.targets = null;
                return;
            }

            initArtifacts();

            // Observe path for d / pending changes
            try {
                pathMutationObserver = new MutationObserver((muts) => {
                    let needs = false;
                    for (const m of muts) {
                        if (m.type === 'attributes' &&
                            (m.attributeName === 'd' || m.attributeName === 'data-cblcars-pending')) {
                            needs = true;
                            break;
                        }
                    }
                    if (needs) {
                        // If pending turned back on, hide trail again
                        if (trailPath && isPending(pathEl)) {
                            trailPath.setAttribute('visibility', 'hidden');
                        }
                        rebindAll('mutation');
                    }
                });
                pathMutationObserver.observe(pathEl, { attributes: true, attributeFilter: ['d', 'data-cblcars-pending'] });
            } catch (_) {}

            // Lightweight poll for element replacement
            const pathId = pathEl.id;
            const reattachPoll = () => {
                if (!alive) return;
                const current = (root.getElementById && root.getElementById(pathId)) || pathEl;
                if (current !== pathEl && current instanceof SVGPathElement) {
                    cblcarsLog.debug('[motionpath] Path element replaced; reinitializing', { id: pathId });
                    try { pathMutationObserver?.disconnect(); } catch (_) {}
                    pathEl = current;
                    cleanupArtifacts();
                    trailPath = null;
                    tracerNode = null;
                    // Wait again for readiness of the new path
                    waitForReady().then((ok) => {
                        if (ok) {
                            initArtifacts();
                            try {
                                pathMutationObserver = new MutationObserver((muts) => {
                                    let needs = false;
                                    for (const m of muts) {
                                        if (m.type === 'attributes' &&
                                            (m.attributeName === 'd' || m.attributeName === 'data-cblcars-pending')) {
                                            needs = true;
                                            break;
                                        }
                                    }
                                    if (needs) rebindAll('mutation(replaced)');
                                });
                                pathMutationObserver.observe(pathEl, { attributes: true, attributeFilter: ['d', 'data-cblcars-pending'] });
                            } catch (_) {}
                        }
                    });
                }
                setTimeout(reattachPoll, 2000);
            };
            setTimeout(reattachPoll, 2000);

            // Prevent base animateElement from adding another animation
            params.targets = null;

            // Cleanup hook if needed later
            element.__cblcars_motionpath_cleanup = () => {
                alive = false;
                try { pathMutationObserver?.disconnect(); } catch (_) {}
                try {
                    if (tracerNode?.__cblcars_motion?.pause) tracerNode.__cblcars_motion.pause();
                } catch (_) {}
                try { cleanupArtifacts(); } catch (_) {}
            };

        } catch (e) {
            cblcarsLog.error('[motionpath] Unhandled error', e);
            svgOverlayManager.push(`[motionpath] ${e?.message || e}`);
            params.targets = null;
        }
    },

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
     * Sets properties/attributes/styles.
     * Behavior:
     * - In timeline steps: leave params as-is so anime.js applies them at the step time (no immediate mutation).
     * - Outside timelines (free/overlay animations): mutate immediately via utils.set() and skip scheduling.
     */
    set: (params, element, options = {}) => {
        // Timeline context: do not immediately set; let the step apply at its offset.
        if (options && options.__timeline) {
        return; // no-op; keep params as-is for anime step
        }

        const ignoreKeys = ['type', 'targets', 'root', 'animation', 'id', 'offset', '__timeline'];
        const allParams = { ...params, ...options };
        const propsToSet = {};
        Object.entries(allParams).forEach(([key, value]) => {
        if (ignoreKeys.includes(key) || value === undefined) return;
        propsToSet[key] = value;
        });

        let animeSetWorked = false;
        try {
        if (window.cblcars?.anim?.utils?.set) {
            window.cblcars.anim.utils.set(element, propsToSet);
            animeSetWorked = true;
        }
        } catch (e) {
        cblcarsLog.warn('[set preset] animejs.utils.set() failed, will fallback to manual mutation.', { e });
        }

        if (!animeSetWorked) {
        for (const [key, value] of Object.entries(propsToSet)) {
            try {
            if (key in element.style) {
                element.style[key] = value;
            } else {
                element.setAttribute(key, value);
            }
            } catch (e) {
            cblcarsLog.warn(`[set preset] Could not set "${key}"="${value}" manually`, { e });
            }
        }
        }

        // Prevent anime scheduling for non-timeline set
        params._cssAnimation = true;
        params.targets = null;
    },

    // Add more presets as needed...
};