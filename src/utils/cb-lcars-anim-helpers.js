import { cblcarsLog } from './cb-lcars-logging.js';
import { animPresets } from './cb-lcars-anim-presets.js';

/**
 * Waits for an element to be present in the DOM.
 * @param {string} selector - The CSS selector for the element.
 * @param {Element|Document} root - The root element to search within.
 * @param {number} timeout - The maximum time to wait in milliseconds.
 * @returns {Promise<Element>}
 */
export function waitForElement(selector, root = document, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const found = root.querySelector(selector);
    if (found) return resolve(found);

    const observer = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el) {
        try { observer.disconnect(); } catch(_) {}
        clearTimeout(to);
        resolve(el);
      }
    });
    observer.observe(root, { childList: true, subtree: true });

    const to = setTimeout(() => {
      try { observer.disconnect(); } catch(_) {}
      reject(new Error(`[CB-LCARS] Timeout waiting for element: ${selector}`));
    }, timeout);
  });
}

/**
 * Resolves one or many targets into an array of Elements.
 * Enhancements:
 * - Supports comma-separated selector strings: "#a, .b, svg path"
 * - Expands NodeList/HTMLCollection into elements
 * - For selector strings, resolves first match by waiting, and also includes any currently matching additional elements
 * @param {string|Element|Array<string|Element>|NodeList|HTMLCollection} targets
 * @param {Element|Document} root
 * @param {number} timeout
 * @returns {Promise<Element[]>}
 */
export async function waitForElements(targets, root = document, timeout = 2000) {
  const toArray = (v) => Array.isArray(v)
    ? v
    : (v && typeof v.length === 'number' && typeof v.item === 'function')
      ? Array.from(v) // NodeList/HTMLCollection
      : [v];

  const items = toArray(targets).filter(Boolean);
  const results = [];

  for (const item of items) {
    try {
      if (item instanceof Element) {
        results.push(item);
        continue;
      }

      if (typeof item === 'string') {
        // Split comma-separated selector lists
        const selectors = item.split(',').map(s => s.trim()).filter(Boolean);
        for (const sel of selectors) {
          // Wait for first appearance of this selector
          const first = await waitForElement(sel, root, timeout);
          if (first) results.push(first);
          // Also include any additional matches that are already present
          const allNow = root.querySelectorAll(sel);
          for (const el of Array.from(allNow)) {
            if (!results.includes(el)) results.push(el);
          }
        }
        continue;
      }

      cblcarsLog.warn('[waitForElements] Unsupported target type, skipping.', { item });
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
 * Unchanged behavior, v4-native through window.cblcars.anim.anime
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

        // state_resolver hook (left as-is)
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
            Object.assign(params, { d: window.cblcars.animejs.svg.morphTo(morphTarget, precision) });
          } else {
            cblcarsLog.debug(`[animateElement] Using standard animation for type: ${type}`, { params });
          }
        }

        // Skip if preset handled via CSS or nulled targets
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
 * v4: Create a single timeline from an array of steps.
 * Uses createTimeline consistently and add(targets, vars, offset).
 * @param {Array} timelineConfig - [{ targets, ...vars, offset? }]
 * @param {string} scopeId
 * @param {Element|Document} root
 */
export async function createTimeline(timelineConfig, scopeId, root = document) {
  const scopeObj = window.cblcars.anim.scopes.get(scopeId);
  const timeline = window.cblcars.anim.animejs.createTimeline({ scope: scopeObj?.scope });

  if (!Array.isArray(timelineConfig)) return timeline;

  for (const step of timelineConfig) {
    const { targets, offset, ...vars } = step || {};
    if (!targets) continue;
    const element = await window.cblcars.anim.waitForElement(targets, root);
    if (!element) continue;
    timeline.add(element, vars, offset);
  }
  if (scopeObj) scopeObj.addAnimation?.(timeline);
  return timeline;
}

/**
 * Creates multiple anime.js timelines from a config object, supporting global params and step merging.
 * Enhancements:
 * - Supports step.state_resolver using variables.msd.presets (stylePresets).
 * - Only strips 'direction' (v4 removed); keeps 'alternate' and 'loop'.
 * - Respects autoplay: does not force timeline.play() when autoplay === false.
 * - Marks preset calls with __timeline for timeline-friendly behavior.
 *
 * @param {object} timelinesConfig
 * @param {string} scopeId
 * @param {Element|Document} root
 * @param {object} overlayConfigs
 * @param {object|null} hass
 * @param {object} stylePresets - variables.msd.presets
 * @returns {Promise<object>} timelines by name
 */
export async function createTimelines(
  timelinesConfig,
  scopeId,
  root = document,
  overlayConfigs = {},
  hass = null,
  stylePresets = {}
) {
  const scopeObj = window.cblcars.anim.scopes.get(scopeId);
  if (!scopeObj) {
    cblcarsLog.error('[createTimelines] Scope not found:', scopeId);
    return {};
  }
  const timelines = {};
  const resolveAll = window.cblcars.styleHelpers?.resolveAllDynamicValues;

  for (const [timelineName, timelineConfig] of Object.entries(timelinesConfig || {})) {
    const { steps, ...timelineGlobals } = timelineConfig || {};
    const resolvedGlobals = resolveAll ? resolveAll(timelineGlobals, hass) : timelineGlobals;

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
      let elements = [];
      try {
        elements = await waitForElements(step.targets, root);
      } catch (error) {
        cblcarsLog.error(`[createTimelines] Failed to find target(s) for "${timelineName}":`, { targets: step.targets, error });
        continue;
      }
      if (!elements || elements.length === 0) {
        cblcarsLog.warn(`[createTimelines] No elements found for timeline "${timelineName}" step:`, { targets: step.targets });
        continue;
      }

      for (const element of elements) {
        const elementAnim = overlayConfigs?.[element.id]?.animation || {};
        let mergedParams = { ...elementAnim, ...resolvedGlobals, ...step };

        // State resolver on steps
        if (step?.state_resolver && window.cblcars.styleHelpers?.resolveStatePreset) {
          try {
            const overrides = window.cblcars.styleHelpers.resolveStatePreset(
              { state_resolver: step.state_resolver, entity: step.entity, attribute: step.attribute },
              stylePresets,
              hass
            );
            if (overrides && typeof overrides === 'object') {
              if (overrides.animation && typeof overrides.animation === 'object') {
                mergedParams = { ...mergedParams, ...overrides.animation };
              } else {
                mergedParams = { ...mergedParams, ...overrides };
              }
            }
          } catch (e) {
            cblcarsLog.warn('[createTimelines] step.state_resolver failed', { timelineName, step, error: e });
          }
        }

        // Resolve dynamic values
        mergedParams = resolveAll ? resolveAll(mergedParams, hass) : mergedParams;

        // Defaults for text transforms in some presets
        if (
          (mergedParams.type === 'pulse' || mergedParams.type === 'glow') &&
          (element.tagName === 'text' || element.tagName === 'TEXT')
        ) {
          element.style.transformOrigin = 'center';
          element.style.transformBox = 'fill-box';
        }

        // Apply preset, marking timeline context
        if (mergedParams.type && animPresets[mergedParams.type]) {
          mergedParams.__timeline = true;
          await animPresets[mergedParams.type](mergedParams, element, mergedParams);
        }

        // Strip non-anime keys
        const {
          targets, offset, direction,
          state_resolver, preset, entity, attribute, __timeline,
          // NEW: strip these flags from anime params
          deep, descendants, apply_to,
          ...animeParams
        } = mergedParams;

        // Determine whether to apply immediate props to descendants
        const applyToDescendants =
          mergedParams.descendants === true ||
          mergedParams.deep === true ||
          mergedParams.apply_to === 'descendants';

        // Ensure non-animated properties are applied at the step start
        const immediateKeys = ['fill', 'stroke', 'stroke-width', 'filter', 'color', 'opacity'];
        const immediateSet = {};
        for (const k of immediateKeys) {
          if (animeParams[k] !== undefined && !Array.isArray(animeParams[k]) && typeof animeParams[k] !== 'object') {
            immediateSet[k] = animeParams[k];
          }
        }
        if (Object.keys(immediateSet).length) {
          const userOnBegin = animeParams.onBegin;
          animeParams.onBegin = () => {
            try {
              const nodes = applyToDescendants ? element.querySelectorAll('*') : [element];
              if (window.cblcars?.anim?.utils?.set) {
                nodes.forEach((n) => window.cblcars.anim.utils.set(n, immediateSet));
              } else {
                nodes.forEach((n) => {
                  for (const [prop, val] of Object.entries(immediateSet)) {
                    if (prop in n.style) n.style[prop] = val;
                    else n.setAttribute(prop, val);
                  }
                });
              }
            } catch (_) {}
            if (typeof userOnBegin === 'function') userOnBegin();
          };
        }

        // v4 add(targets, vars, offset)
        timeline.add(element, animeParams, offset);
      }
    }

    if (typeof scopeObj.addAnimation === 'function') {
      scopeObj.addAnimation(timeline);
    }
    timelines[timelineName] = timeline;

    if (resolvedGlobals?.autoplay === false) {
      cblcarsLog.info(`[createTimelines] Timeline "${timelineName}" created with autoplay: false.`);
    }
  }
  return timelines;
}

/**
 * Applies one or more animation presets to the anime.js params object.
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


