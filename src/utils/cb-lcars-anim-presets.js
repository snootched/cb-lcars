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
  motionpath: async function(params, element, options) {
    const { path_selector, root = document, trail, tracer } = options;
    if (!path_selector) {
      window.cblcars.cblcarsLog.error('[motionpath preset] Missing path_selector.', { options });
      return;
    }
    const pathElement = await window.cblcars.waitForElement(path_selector, root);
    if (!pathElement) {
      window.cblcars.cblcarsLog.error('[motionpath preset] Could not find path element.', { path_selector });
      return;
    }

    // Animate trail if requested
    if (trail) {
      try {
        const drawable = window.cblcars.animejs.svg.createDrawable(pathElement);
        const trailTarget = Array.isArray(drawable) ? drawable[0] : drawable;
        if (trailTarget instanceof SVGElement) {
          const trailOptions = typeof trail === 'object' && trail !== null ? trail : {};
          const animeConfig = {
            draw: '0 1',
            duration: trailOptions.duration ?? params.duration ?? 1000,
            easing: trailOptions.easing ?? params.easing ?? 'easeInOutQuad',
            loop: trailOptions.loop ?? params.loop,
          };
          if (trailOptions && Object.prototype.toString.call(trailOptions) === '[object Object]') {
            Object.assign(animeConfig, trailOptions);
          }
          window.cblcars.anime(trailTarget, animeConfig);
        } else {
          window.cblcars.cblcarsLog.error('[motionpath preset] Trail target is not a valid SVGElement.', { trailTarget });
        }
      } catch (trailerError) {
        window.cblcars.cblcarsLog.error('[motionpath preset] Failed to animate trail:', { trailerError });
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
        window.cblcars.cblcarsLog.debug('[motionpath preset] Tracer SVG appended', { tracerId, svgRoot });
      } else {
        // fallback: append to path parent
        pathElement.parentNode.appendChild(tracerNode);
        window.cblcars.cblcarsLog.warn('[motionpath preset] Could not find SVG root, appended tracer to path parent.', { tracerId });
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

      window.cblcars.cblcarsLog.debug('[motionpath preset] Animating tracer', { tracerId, merged });
      window.cblcars.anime(tracerNode, {
        ...merged,
        translateX,
        translateY,
        rotate,
      });
      return; // Do not animate the line itself
    }

    // If no tracer, animate the line itself (legacy/fallback)
    const { translateX, translateY, rotate } = window.cblcars.animejs.svg.createMotionPath(pathElement);
    Object.assign(params, { translateX, translateY, rotate });
  },
  // Add more presets as needed...
};
