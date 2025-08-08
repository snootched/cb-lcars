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
 * Resolves one or many targets into an array of Elements.
 * Supports string selector, Element, NodeList, and arrays of the above.
 * @param {string|Element|Array<string|Element>|NodeList} targets
 * @param {Element} root
 * @param {number} timeout
 * @returns {Promise<Element[]>}
 */
export async function waitForElements(targets, root = document, timeout = 2000) {
  const toArray = (v) => Array.isArray(v)
    ? v
    : (v && typeof v.length === 'number' && typeof v.item === 'function') // NodeList/HTMLCollection
      ? Array.from(v)
      : [v];

  const items = toArray(targets).filter(Boolean);
  const results = [];

  for (const item of items) {
    try {
      if (item instanceof Element) {
        results.push(item);
      } else if (typeof item === 'string') {
        // Wait for the first element that matches each selector
        const el = await waitForElement(item, root, timeout);
        if (el) results.push(el);
      } else {
        cblcarsLog.warn('[waitForElements] Unsupported target type, skipping.', { item });
      }
    } catch (e) {
      cblcarsLog.error('[waitForElements] Failed to resolve target:', { item, error: e });
    }
  }
  return results;
}

/**
 * A generic wrapper for anime.js that resolves targets within a given root element.
 * If scopeId is provided, add the animation to the scope.
 * @param {object} options - The anime.js animation options.
 * @param {string|Element|Array} options.targets - Selector(s) or element(s).
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
    const elements = await waitForElements(targets, root);
    if (elements.length === 0) {
      cblcarsLog.warn('[animateWithRoot] No targets resolved.', { targets });
      return;
    }

    for (const element of elements) {
      try {
        let animation;
        if (scopeId && window.cblcars.anim.scopes.has(scopeId)) {
          const scopeObj = window.cblcars.anim.scopes.get(scopeId);
          animation = window.cblcars.anime(element, { ...animOptions, scope: scopeObj.scope });
          scopeObj.addAnimation(animation);
        } else {
          animation = window.cblcars.anime(element, animOptions);
        }
      } catch (e) {
        cblcarsLog.error('[animateWithRoot] Failed to animate a resolved element.', { element: element?.id, error: e });
      }
    }
  } catch (error) {
    cblcarsLog.error('[animateWithRoot] Failed to animate element(s):', { targets, error });
  }
}

/**
 * Animates element(s) using anime.js with special handling for SVG animations.
 * If scopeId is provided, add the animation to the scope.
 * @param {CBLCARSAnimationScope} scope - The scope object to use.
 * @param {object} options - The animation options.
 * @param {string|string[]} options.type - The type of animation (preset) to apply.
 * @param {string|Element|Array} options.targets - Selector(s) or element(s).
 * @param {Element} [options.root=document] - The root element for the selector query.
 */
export async function animateElement(scope, options, hass = null) {
  const { type, targets, root = document, ...animOptions } = options;
  if (!type || !targets || !scope) {
    cblcarsLog.warn('[animateElement] Animation missing type, targets, or scope.', { options, scope });
    return;
  }
  cblcarsLog.debug('[animateElement] Received options:', { options });

  scope.scope.add(async () => {
    try {
      const elements = await waitForElements(targets, root);
      if (!elements || elements.length === 0) {
        cblcarsLog.error('[animateElement] Target element(s) not found:', { targets });
        return;
      }

      for (const element of elements) {
        const params = {
          duration: 1000,
          easing: 'easeInOutQuad',
          ...animOptions,
        };

        // Optional: state_resolver (kept as-is)
        if (options.state_resolver && options.entity && window.cblcars.styleHelpers?.resolveStateStyles) {
          const resolvedStyles = window.cblcars.styleHelpers.resolveStateStyles(
            options.state_resolver,
            hass,
            options.entity
          );
          Object.assign(params, resolvedStyles);
        }

        // Apply preset(s)
        if (Array.isArray(type)) {
          applyPresets(type, params, element, options);
        } else {
          const presetFn = animPresets[String(type).toLowerCase()];
          if (presetFn) {
            await presetFn(params, element, options);
          } else if (String(type).toLowerCase() === 'morph') {
            if (!options.morph_to_selector) {
              cblcarsLog.error('[animateElement] morph animation requires a `morph_to_selector`.', { options });
              continue;
            }
            const morphTarget = await waitForElement(options.morph_to_selector, root);
            if (!morphTarget) {
              cblcarsLog.error(`[animateElement] morph could not find target shape for selector: ${options.morph_to_selector}`);
              continue;
            }
            const precision = options.precision ? parseInt(options.precision, 10) : undefined;
            Object.assign(params, {
              d: window.cblcars.animejs.svg.morphTo(morphTarget, precision),
            });
          } else {
            cblcarsLog.debug(`[animateElement] Using standard animation for type: ${type}`, { params });
          }
        }

        // Skip creating an animation if the preset used CSS or nulled targets
        if (params._cssAnimation || params.targets === null) {
          continue;
        }

        window.cblcars.anim.anime(element, params);
        cblcarsLog.debug(`[animateElement] Animation constructor added to scope: ${scope.id}`, { params, element: element.id });
      }
    } catch (error) {
      cblcarsLog.error('[animateElement] Failed to animate element(s):', { targets, type, error });
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
    timeline.add(element, animOptions);
  }
  if (scopeObj) scopeObj.addAnimation(timeline);
  return timeline;
}

/**
 * Creates multiple anime.js timelines from a config object, supporting global params and step merging.
 * @param {object} timelinesConfig - Object of timelines keyed by name.
 * @param {string} scopeId - The scope ID to use.
 * @param {Element} root - The root element for selectors.
 * @param {object} overlayConfigs - Overlay configs for element-level animation merging.
 * @param {object} hass - Home Assistant context for dynamic value resolution.
 * @returns {Promise<object>} Object of timelines keyed by name.
 */
export async function createTimelines(timelinesConfig, scopeId, root = document, overlayConfigs = {}, hass = null) {
  const scopeObj = window.cblcars.anim.scopes.get(scopeId);
  if (!scopeObj) {
    cblcarsLog.error('[createTimelines] Scope not found:', scopeId);
    return {};
  }
  const timelines = {};
  for (const [timelineName, timelineConfig] of Object.entries(timelinesConfig)) {
    const { steps, ...timelineGlobals } = timelineConfig;
    const resolvedGlobals = window.cblcars.styleHelpers?.resolveAllDynamicValues
      ? window.cblcars.styleHelpers.resolveAllDynamicValues(timelineGlobals, hass)
      : timelineGlobals;

    const timeline = window.cblcars.anim.animejs.createTimeline({
      scope: scopeObj.scope,
      ...resolvedGlobals
    });

    if (!steps || !Array.isArray(steps)) {
      cblcarsLog.warn(`[createTimelines] Timeline "${timelineName}" has no steps array.`);
      timelines[timelineName] = timeline;
      continue;
    }

    for (const step of steps) {
      // Resolve all target elements for this step (supports arrays)
      let elements = [];
      try {
        elements = await waitForElements(step.targets, root);
      } catch (error) {
        cblcarsLog.error(`[createTimelines] Failed to find target element(s) in "${timelineName}":`, { targets: step.targets, error });
        continue;
      }
      if (!elements || elements.length === 0) {
        cblcarsLog.warn(`[createTimelines] No elements found for timeline "${timelineName}" step:`, { targets: step.targets });
        continue;
      }

      for (const element of elements) {
        // Merge: element animation block → timeline globals → step params (step wins)
        const elementAnim = overlayConfigs?.[element.id]?.animation || {};
        let mergedParams = { ...elementAnim, ...resolvedGlobals, ...step };
        mergedParams = window.cblcars.styleHelpers?.resolveAllDynamicValues
          ? window.cblcars.styleHelpers.resolveAllDynamicValues(mergedParams, hass)
          : mergedParams;

        // Debug: log element info before preset
        cblcarsLog.debug(`[createTimelines] Step "${timelineName}" target resolved:`, {
          targets: step.targets,
          element,
          tagName: element.tagName,
          mergedParams
        });

        if (
          (mergedParams.type === 'pulse' || mergedParams.type === 'glow') &&
          (element.tagName === 'text' || element.tagName === 'TEXT')
        ) {
          element.style.transformOrigin = 'center';
          element.style.transformBox = 'fill-box';
          cblcarsLog.debug(`[createTimelines] Set transformOrigin/transformBox for text element:`, {
            id: element.id,
            style: element.style.cssText
          });
        }

        // Apply preset if type is specified
        if (mergedParams.type && animPresets[mergedParams.type]) {
          const presetOptions = step[mergedParams.type] || {};
          cblcarsLog.debug(`[createTimelines] Before preset "${mergedParams.type}" mutation:`, { mergedParams, presetOptions });
          await animPresets[mergedParams.type](mergedParams, element, mergedParams);
          cblcarsLog.debug(`[createTimelines] After preset "${mergedParams.type}" mutation:`, { mergedParams, element });
        }

        // Remove timeline-level properties before adding to timeline
        const { targets, offset, ...animeParams } = mergedParams;
        delete animeParams.loop;
        delete animeParams.direction;
        delete animeParams.alternate;

        cblcarsLog.debug(`[createTimelines] Final animeParams for timeline.add:`, {
          timelineName,
          targets: element,
          animeParams,
          offset
        });

        timeline.add(element, animeParams, offset);

        cblcarsLog.debug(`[createTimelines] Added step to timeline "${timelineName}":`, {
          targets: element,
          animeParams,
          offset,
          tagName: element.tagName,
          style: element.style.cssText
        });
      }
    }

    console.debug(`[createTimelines] Created timeline "${timelineName}":`, timeline);
    if (typeof scopeObj.addAnimation === 'function') {
      scopeObj.addAnimation(timeline);
    }
    timelines[timelineName] = timeline;
    if (timeline && typeof timeline.play === 'function') {
      timeline.play();
      cblcarsLog.info(`[createTimelines] Timeline "${timelineName}" play() called.`);
      console.debug(`[createTimelines] Timeline:`, timeline);
      console.debug(`[createTimelines] Timeline "${timelineName}" state:`, {
        paused: timeline.paused,
        children: timeline.children,
        duration: timeline.duration,
        animations: timeline.animations,
        id: timeline.id
      });
    }
  }
  return timelines;
}

/**
 * Applies one or more animation presets to the anime.js params object.
 * Each preset mutates/augments params for stacking/chaining.
 * @param {string|string[]} types - Preset name(s) to apply.
 * @param {object} params - Anime.js params object to mutate.
 * @param {Element} element - Target element.
 * @param {object} options - Animation config (per-preset config supported).
 */
export function applyPresets(types, params, element, options) {
    const presetList = Array.isArray(types) ? types : [types];
    for (const type of presetList) {
        const presetFn = animPresets[type.toLowerCase()];
        if (presetFn) {
            presetFn(params, element, options?.[type] || options);
        }
    }
}


