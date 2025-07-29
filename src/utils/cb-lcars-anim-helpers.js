import { cblcarsLog } from './cb-lcars-logging.js';
import { animPresets } from './cb-lcars-anim-presets.js';

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
    const element = await waitForElement(targets, root);

    const params = {
      targets: element,
      duration: 1000,
      easing: 'easeInOutQuad',
      ...animOptions,
    };

    // --- Use preset if available ---
    const presetFn = animPresets[type.toLowerCase()];
    if (presetFn) {
      await presetFn(params, element, options);
    } else if (type.toLowerCase() === 'morph') {
      // Special case: morph
      if (!options.morph_to_selector) {
        cblcarsLog.error('[animateElement] morph animation requires a `morph_to_selector`.', { options });
        return;
      }
      const morphTarget = await waitForElement(options.morph_to_selector, root);
      if (!morphTarget) {
        cblcarsLog.error(`[animateElement] morph could not find target shape for selector: ${options.morph_to_selector}`);
        return;
      }
      const precision = options.precision ? parseInt(options.precision, 10) : undefined;
      Object.assign(params, {
        d: window.cblcars.animejs.svg.morphTo(morphTarget, precision),
      });
    } else {
      // Fallback: treat as standard anime.js property
      cblcarsLog.debug(`[animateElement] Using standard animation for type: ${type}`, { params });
    }

    const { targets: finalTargets, ...finalParams } = params;
    window.cblcars.anime(finalTargets, finalParams);
  } catch (error) {
    cblcarsLog.error('[animateElement] Failed to animate element:', { targets, type, error });
  }
}
