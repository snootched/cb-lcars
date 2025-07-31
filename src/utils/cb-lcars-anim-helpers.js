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
 * If scopeId is provided, add the animation to the scope.
 * @param {object} options - The anime.js animation options.
 * @param {string|Element} options.targets - The CSS selector for the target element(s) or the element itself.
 * @param {Element} [options.root=document] - The root element for the selector query.
 * @param {string} [options.scopeId] - The scope ID to use.
 */
export async function animateWithRoot(options) {
  const { targets, root = document, scopeId, ...animOptions } = options;
  if (!targets) {
    cblcarsLog.warn('[animateWithRoot] Animation missing targets.', { options });
    return;
  }
  try {
    const element = await waitForElement(targets, root);
    let animation;
    if (scopeId && window.cblcars.anim.scopes.has(scopeId)) {
      const scopeObj = window.cblcars.anim.scopes.get(scopeId);
      animation = window.cblcars.anime(element, { ...animOptions, scope: scopeObj.scope });
      scopeObj.addAnimation(animation); // Optional, but not strictly needed if scope is passed
    } else {
      animation = window.cblcars.anime(element, animOptions);
    }
  } catch (error) {
    cblcarsLog.error('[animateWithRoot] Failed to animate element:', { targets, error });
  }
}

/**
 * Animates an element using anime.js with special handling for SVG animations.
 * If scopeId is provided, add the animation to the scope.
 * @param {CBLCARSAnimationScope} scope - The scope object to use.
 * @param {object} options - The animation options.
 * @param {string} options.type - The type of animation (e.g., 'draw', 'fade', 'motionPath', 'morph').
 * @param {string} options.targets - The CSS selector for the target element(s).
 * @param {Element} [options.root=document] - The root element for the selector query.
 */
export async function animateElement(scope, options) {
  const { type, targets, root = document, ...animOptions } = options;
  if (!type || !targets || !scope) {
    cblcarsLog.warn('[animateElement] Animation missing type, targets, or scope.', { options, scope });
    return;
  }

  // Use the scope's .add() method to register an animation constructor.
  // This is the idiomatic way to create animations within a scope in anime.js v4.
  scope.scope.add(async () => {
    try {
      const element = await waitForElement(targets, root);
      if (!element) {
        cblcarsLog.error('[animateElement] Target element not found:', { targets });
        return;
      }

      const params = {
        targets: element,
        duration: 1000,
        easing: 'easeInOutQuad',
        ...animOptions,
      };

      const presetFn = animPresets[type.toLowerCase()];
      if (presetFn) {
        await presetFn(params, element, options);
      } else if (type.toLowerCase() === 'morph') {
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
        cblcarsLog.debug(`[animateElement] Using standard animation for type: ${type}`, { params });
      }

      // Don't create an animation if the preset is CSS-based
      if (params._cssAnimation) {
          return;
      }

      // If the preset nulled the targets (e.g. motionpath with tracer), don't create the animation.
      if (!params.targets) {
          return;
      }

      // The animate call is now inside the scope.add() callback.
      // It will be automatically managed by the scope.
      const { targets: finalTargets, ...finalParams } = params;
      window.cblcars.anim.anime(finalTargets, finalParams);
      cblcarsLog.debug(`[animateElement] Animation constructor added to scope: ${scope.id}`, { params });

    } catch (error) {
      cblcarsLog.error('[animateElement] Failed to animate element:', { targets, type, error });
    }
  });
}

/**
 * Creates an anime.js timeline within a given scope.
 * @param {Array} timelineConfig - Array of timeline steps.
 * @param {string} scopeId - The scope ID to use.
 * @param {Element} root - The root element for selectors.
 * @returns {anime.Timeline} The created timeline.
 */
export async function createTimeline(timelineConfig, scopeId, root = document) {
    const scopeObj = window.cblcars.anim.scopes.get(scopeId);
    const timeline = window.cblcars.animejs.timeline({ scope: scopeObj?.scope });
    for (const step of timelineConfig) {
        const { targets, ...animOptions } = step;
        const element = await window.cblcars.anim.waitForElement(targets, root);
        timeline.add({
            targets: element,
            ...animOptions
        });
    }
    if (scopeObj) scopeObj.addAnimation(timeline);
    return timeline;
}

