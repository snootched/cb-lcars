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

      // Support stacking/chaining: type can be string or array
      if (Array.isArray(type)) {
        applyPresets(type, params, element, options);
      } else {
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
        // Dynamic value resolution for timeline globals
        const resolvedGlobals = window.cblcars.styleHelpers?.resolveAllDynamicValues
            ? window.cblcars.styleHelpers.resolveAllDynamicValues(timelineGlobals, hass)
            : timelineGlobals;

        // Create timeline with scope and global params
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
            // Merge: element animation block → timeline globals → step params (step wins)
            const targetId = (typeof step.targets === 'string' && step.targets.startsWith('#'))
                ? step.targets.slice(1)
                : step.targets;
            const elementAnim = overlayConfigs?.[targetId]?.animation || {};
            let mergedParams = { ...elementAnim, ...resolvedGlobals, ...step };
            mergedParams = window.cblcars.styleHelpers?.resolveAllDynamicValues
                ? window.cblcars.styleHelpers.resolveAllDynamicValues(mergedParams, hass)
                : mergedParams;

            let element;
            try {
                element = await window.cblcars.anim.waitForElement(step.targets, root);
            } catch (error) {
                cblcarsLog.error(`[createTimelines] Failed to find target element in "${timelineName}":`, { targets: step.targets, error });
                continue;
            }
            if (!element) {
                cblcarsLog.warn(`[createTimelines] Element not found for timeline "${timelineName}" step:`, { targets: step.targets });
                continue;
            }

            // Debug: log element info before preset
            cblcarsLog.debug(`[createTimelines] Step "${timelineName}" target resolved:`, {
                targets: step.targets,
                element,
                tagName: element.tagName,
                mergedParams
            });

            // --- Ensure transform-origin for text elements with pulse/glow ---
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

            // --- Apply preset if type is specified ---
            if (mergedParams.type && animPresets[mergedParams.type]) {
                const presetOptions = step[mergedParams.type] || {};
                cblcarsLog.debug(`[createTimelines] Before preset "${mergedParams.type}" mutation:`, { mergedParams, presetOptions });
                await animPresets[mergedParams.type](mergedParams, element, presetOptions);
                cblcarsLog.debug(`[createTimelines] After preset "${mergedParams.type}" mutation:`, { mergedParams, element });
            }

            // Remove timeline-level properties before adding to timeline
            delete mergedParams.loop;
            delete mergedParams.direction;
            delete mergedParams.alternate;

            // Debug: log final params before timeline.add
            cblcarsLog.debug(`[createTimelines] Final animeParams for timeline.add:`, {
                timelineName,
                targets: element,
                animeParams: mergedParams,
                offset: mergedParams.offset
            });

            const { targets, offset, ...animeParams } = mergedParams;
            timeline.add(element, animeParams, offset);

            cblcarsLog.debug(`[createTimelines] Added step to timeline "${timelineName}":`, {
                targets: element,
                animeParams,
                offset,
                tagName: element.tagName,
                style: element.style.cssText
            });
        }

        // Remove or comment out this line:
        // console.debug(`[createTimelines] Created timeline "${timelineName}" with steps:`, timeline.steps);
        // Optionally, just log the timeline object:
        console.debug(`[createTimelines] Created timeline "${timelineName}":`, timeline);

        // Only call addAnimation if scopeObj has it (i.e., is CBLCARSAnimationScope)
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
        const presetFn = animPresets[type];
        if (presetFn) {
            presetFn(params, element, options?.[type] || options);
        }
    }
}

