import { cblcarsLog } from './cb-lcars-logging.js';

/**
 * Waits for an element to be present in the DOM.
 * @param {string} selector - The CSS selector for the element.
 * @param {Element} root - The root element to search within.
 * @param {number} timeout - The maximum time to wait in milliseconds.
 * @returns {Promise<Element>} A promise that resolves with the element when found.
 */
export function waitForElement(selector, root = document, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const element = root.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`[CB-LCARS] Timeout waiting for element: ${selector}`));
    }, timeout);
  });
}

/**
 * A generic wrapper for anime.js that resolves targets within a given root element.
 * This is useful for animations within a shadow DOM.
 * @param {object} options - The anime.js animation options.
 * @param {string|Element} options.targets - The CSS selector for the target element(s) or the element itself.
 * @param {Element} [options.root=document] - The root element for the selector query.
 */
export async function animateWithRoot(options) {
  const { targets, root = document, ...animOptions } = options;

  if (!targets) {
    cblcarsLog.warn('[animateWithRoot] Animation missing targets.', { options });
    return;
  }

  try {
    const element = await waitForElement(targets, root);
    // Correct v4 signature: anime(targets, options)
    window.cblcars.anime(element, animOptions);
  } catch (error) {
    cblcarsLog.error('[animateWithRoot] Failed to animate element:', { targets, error });
  }
}

/**
 * Animates an element using anime.js with special handling for SVG animations.
 * @param {object} options - The animation options.
 * @param {string} options.type - The type of animation (e.g., 'draw', 'fade', 'motionPath', 'morph').
 * @param {string} options.targets - The CSS selector for the target element(s).
 * @param {Element} [options.root=document] - The root element for the selector query.
 */
export async function animateElement(options) {
  const { type, targets, root = document, ...animOptions } = options;

  if (!type || !targets) {
    cblcarsLog.warn('[animateElement] Animation missing type or targets.', { options });
    return;
  }

  try {
    // Wait for the target element and, crucially, capture the resolved element.
    const element = await waitForElement(targets, root);

    // Base anime.js parameters. Use the resolved element as the target.
    const params = {
      targets: element,
      duration: 1000,
      easing: 'easeInOutQuad',
      ...animOptions,
    };

    // --- Animation Type Presets ---
    switch (type.toLowerCase()) {
      case 'draw':
        // Draws a solid line from start to finish. Does not loop by default.
        Object.assign(params, {
          strokeDashoffset: (el) => {
            const pathLength = el.getTotalLength();
            el.style.strokeDasharray = pathLength;
            return [pathLength, 0];
          },
        });
        break;

      case 'march': {
        // Creates a "marching ants" effect on a dashed line. Loops by default.
        const dashArray = element.getAttribute('stroke-dasharray');
        if (!dashArray || dashArray === 'none') {
          cblcarsLog.warn('[animateElement] "march" animation requires a stroke-dasharray to be set on the line.');
          break;
        }
        const patternLength = dashArray.split(/[\s,]+/).reduce((acc, len) => acc + parseFloat(len), 0);
        if (patternLength === 0) break;

        // Set the initial offset to 0 before the animation starts.
        element.style.strokeDashoffset = '0';

        // Animate from 0 to the negative pattern length for a seamless loop.
        const endValue = params.direction === 'reverse' ? patternLength : -patternLength;

        Object.assign(params, {
          strokeDashoffset: [0, endValue],
        });

        // Marching ants should loop and be linear by default
        if (params.loop === undefined) params.loop = true;
        if (params.easing === 'easeInOutQuad') params.easing = 'linear';
        break;
      }

      case 'fade':
        // Simple fade in/out.
        // `direction: 'reverse'` fades out.
        Object.assign(params, {
          opacity: [0, 1],
        });
        break;

      case 'pulse':
        // A gentle scaling and fading effect.
        Object.assign(params, {
          scale: [1, 1.1],
          opacity: [1, 0.7],
          direction: 'alternate',
          loop: true,
          easing: 'easeInOutSine',
        });
        break;

      case 'blink':
        // Blinking effect.
        Object.assign(params, {
            opacity: [options.max_opacity ?? 1, options.min_opacity ?? 0.3],
            direction: 'alternate',
            loop: true,
            easing: options.easing || 'easeInOutSine', // Smoother default easing
        });
        break;

      case 'motionpath': {
        // Moves the target element along an SVG path.
        // Requires `path_selector` to be defined in the animation options.
        if (!options.path_selector) {
          cblcarsLog.error('[animateElement] motionPath animation requires a `path_selector`.', { options });
          return;
        }
        const pathElement = await waitForElement(options.path_selector, root);

        if (!pathElement) {
          cblcarsLog.error(`[animateElement] motionPath could not find path element for selector: ${options.path_selector}`);
          return;
        }

        // Correct v4 implementation using svg.createMotionPath()
        const { translateX, translateY, rotate } = window.cblcars.animejs.svg.createMotionPath(pathElement);
        Object.assign(params, { translateX, translateY, rotate });
        break;
      }

      case 'morph': {
        // Morphs one SVG shape into another.
        // Requires `morph_to_selector` to be defined.
        if (!options.morph_to_selector) {
          cblcarsLog.error('[animateElement] morph animation requires a `morph_to_selector`.', { options });
          return;
        }
        const morphTarget = await waitForElement(options.morph_to_selector, root);
        if (!morphTarget) {
          cblcarsLog.error(`[animateElement] morph could not find target shape for selector: ${options.morph_to_selector}`);
          return;
        }

        // Use anime.js's built-in morphTo utility, passing the precision parameter.
        const precision = options.precision ? parseInt(options.precision, 10) : undefined;
        Object.assign(params, {
          d: window.cblcars.animejs.svg.morphTo(morphTarget, precision),
        });
        break;
      }

      default:
        // For any other animation type, assume it's a standard anime.js property.
        // This allows for direct use of anime.js features like `translateX`, `scale`, etc.
        cblcarsLog.debug(`[animateElement] Using standard animation for type: ${type}`, { params });
        break;
    }

    // Execute the animation with the correct signature (targets, options)
    const { targets: finalTargets, ...finalParams } = params;
    window.cblcars.anime(finalTargets, finalParams);
  } catch (error) {
    cblcarsLog.error('[animateElement] Failed to animate element:', { targets, type, error });
  }
}

