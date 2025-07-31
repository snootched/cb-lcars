import * as anime from 'animejs';

/**
 * Deeply merges properties from one or more source objects into a target object.
 * Note: This function mutates the target object.
 * @param {object} target - The object to merge properties into.
 * @param {...object} sources - The source objects to merge properties from.
 * @returns {object} The mutated target object.
 */
export function deepMerge(target, ...sources) {
  const isObject = (obj) => obj && typeof obj === 'object' && !Array.isArray(obj);

  for (const source of sources) {
    if (!isObject(source)) {
      continue;
    }

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const targetValue = target[key];
        const sourceValue = source[key];

        // If both are objects, recurse.
        // If source is an object and target is not, start a new merge on the source object.
        if (isObject(sourceValue)) {
          if (isObject(targetValue)) {
            target[key] = deepMerge(targetValue, sourceValue);
          } else {
            // Overwrite non-object target with a deep copy of the source object
            target[key] = deepMerge({}, sourceValue);
          }
        } else {
          // Otherwise, just assign the value from the source.
          target[key] = sourceValue;
        }
      }
    }
  }

  return target;
}

/**
 * Merges multiple configuration objects for a callout with a specific precedence.
 * The merge order is: defaults -> preset -> customPreset -> callout -> stateOverrides.
 * It performs a deep merge for each top-level key (e.g., 'text', 'line').
 * @param {object} options - The configuration objects to merge.
 * @param {object} [options.defaults={}] - The base default configuration.
 * @param {object} [options.preset={}] - The named preset configuration.
 * @param {object} [options.customPreset={}] - The user-defined custom preset.
 * @param {object} [options.callout={}] - The specific callout configuration.
 * @param {object} [options.stateOverrides={}] - The overrides from a state_resolver match.
 * @returns {object} The final, merged configuration object for the callout.
 */
export function resolveCalloutStyles({defaults, preset, customPreset, callout, stateOverrides}) {
  // Perform a single deep merge with the correct precedence.
  // This correctly handles top-level primitive values like 'anchor'.
  return deepMerge({}, defaults, preset, customPreset, callout, stateOverrides);
}

/**
 * Checks if a value is a dynamic mapping object.
 * @param {*} v - The value to check.
 * @returns {boolean} True if it's a valid dynamic mapping object.
 */
function isDynamicMapping(v) {
  return (
    v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    v.entity_id &&
    Array.isArray(v.input_range) &&
    Array.isArray(v.output_range)
  );
}

/**
 * Resolves a dynamic value based on entity state using interpolation.
 * @param {object} mapping - The mapping configuration.
 * @param {object} hass - The Home Assistant hass object.
 * @returns {string|number|null} The resolved value or null if resolution fails.
 */
function resolveDynamicValue(mapping, hass) {
  if (!hass || !hass.states) return null;
  if (!anime.utils || typeof anime.utils.mapRange !== 'function') {
    console.warn('Dynamic mapping: anime.js utils.mapRange function not available.');
    return null;
  }

  const entity = hass.states[mapping.entity_id];
  if (!entity) {
    console.warn(`Dynamic mapping: entity not found: ${mapping.entity_id}`);
    return null;
  }

  const rawValue = mapping.attribute ? entity.attributes[mapping.attribute] : entity.state;
  // Use a fallback of 0 if the value is null or undefined (e.g., brightness of an 'off' light)
  const sourceValue = parseFloat(rawValue ?? 0);

  if (isNaN(sourceValue)) {
    console.warn(`Dynamic mapping: source value is not a number for entity ${mapping.entity_id}`, { rawValue });
    return null;
  }

  const [inputMin, inputMax] = mapping.input_range;
  // Ensure output range values are parsed as numbers for interpolation.
  const outputMin = parseFloat(mapping.output_range[0]);
  const outputMax = parseFloat(mapping.output_range[1]);

  if (isNaN(outputMin) || isNaN(outputMax)) {
    console.warn(`Dynamic mapping: output_range values are not valid numbers for entity ${mapping.entity_id}`, { mapping });
    return null;
  }

  // Use anime.js utils.mapRange which handles clamping and interpolation in one step.
  const mapper = anime.utils.mapRange(inputMin, inputMax, outputMin, outputMax);
  let result = mapper(sourceValue);

  // If the output was numeric, we can add rounding and a unit if specified.
  if (typeof result === 'number') {
    if (mapping.round !== undefined) {
      result = parseFloat(result.toFixed(mapping.round));
    }
  }

  return result;
}

/**
 * Recursively traverses a configuration object and resolves any dynamic value mappings.
 * @param {*} data - The data to process (object, array, or primitive).
 * @param {object} hass - The Home Assistant hass object.
 * @returns {*} The processed data with dynamic values resolved.
 */
export function resolveAllDynamicValues(data, hass) {
  if (isDynamicMapping(data)) {
    return resolveDynamicValue(data, hass);
  }

  if (Array.isArray(data)) {
    return data.map(item => resolveAllDynamicValues(item, hass));
  }

  if (data && typeof data === 'object') {
    const newObj = {};
    for (const key in data) {
      newObj[key] = resolveAllDynamicValues(data[key], hass);
    }
    return newObj;
  }

  return data;
}


// Split style vs. SVG attribute
const SVG_ATTRS = [
  'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'fill', 'fill-opacity', 'filter', 'marker-end', 'marker-start', 'marker-mid',
  'font-size', 'font-family', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline'
];

// Helper: map config keys to SVG attribute names
function mapKeyToSvgAttr(key, context = '') {
  // Common mappings
  const keyMap = {
    font_size: 'font-size',
    font_family: 'font-family',
    font_weight: 'font-weight',
    font_style: 'font-style',
    align: 'text-anchor',
    stroke_dasharray: 'stroke-dasharray',
    stroke_linecap: 'stroke-linecap',
    stroke_linejoin: 'stroke-linejoin',
    corner_radius: 'rx', // for rects, not used here
    color: context === 'text' ? 'fill' : 'stroke',
    // Always map width to stroke-width except for text context
    width: context === 'text' ? undefined : 'stroke-width',
    opacity: 'opacity'
    // Add more as needed
  };
  if (keyMap[key]) return keyMap[key];
  // Convert camelCase or underscore to kebab-case
  return key.replace(/_/g, '-').replace(/[A-Z]/g, m => '-' + m.toLowerCase());
}

/**
 * Splits a configuration object's properties into SVG attributes and CSS styles.
 * It uses a predefined list (`SVG_ATTRS`) and key mappings (`mapKeyToSvgAttr`)
 * to determine if a property should be an attribute or a style.
 * @param {object} obj - The configuration object to process (e.g., `computed.line`).
 * @param {string} [context=''] - The context ('text' or 'line') to resolve ambiguous keys like 'color'.
 * @returns {{attrs: object, style: object}} An object containing separated attributes and styles.
 */
export function splitAttrsAndStyle(obj, context = '') {
  const attrs = {};
  const style = {};
  if (!obj || typeof obj !== "object") return {attrs, style};
  for (const [k, v] of Object.entries(obj)) {
    const svgKey = mapKeyToSvgAttr(k, context);

    // 1. Check if the key is a standard SVG presentation attribute.
    // These are properties that can be set directly as attributes on an SVG element.
    // The `SVG_ATTRS` array contains a list of these known attributes.
    if (SVG_ATTRS.includes(svgKey) || svgKey.startsWith('data-')) {
      // Special handling for color object
      if (k === 'color' && typeof v === 'object' && v !== null) {
        attrs[svgKey] = v.default ?? Object.values(v)[0];
      } else {
        attrs[svgKey] = v;
      }
    // 2. Check if the key is a property that must be an inline CSS style.
    // These properties are not valid as direct SVG attributes but work inside a `style` attribute.
    // To make a property a style, add its original key (e.g., "text_transform") to this list.
    } else if (
      k === "opacity" ||
      k === "display" ||
      k === "visibility" ||
      k === "pointer-events" ||
      k === "text_transform"
    ) {
      style[svgKey] = v;
    // 3. As a fallback, treat any other simple value as a non-standard attribute.
    // This allows for custom data attributes or other less common SVG attributes.
    } else if (typeof v === "string" || typeof v === "number") {
      attrs[svgKey] = v;
    }
  }
  return { attrs, style };
}

/**
 * Checks if an entity (optionally with attribute) matches a range.
 * @param {object} hass - Home Assistant hass object.
 * @param {object} stateObj - State resolver object {entity, attribute, from, to, preset}
 * @returns {boolean}
 */
export function entityMatchesRange(hass, stateObj, fallbackEntity, fallbackAttribute) {
  const entityId = stateObj.entity || fallbackEntity;
  if (!hass || !hass.states || !entityId) return false;
  const entity = hass.states[entityId];
  if (!entity) return false;
  let value = (stateObj.attribute || fallbackAttribute) ? entity.attributes[stateObj.attribute || fallbackAttribute] : entity.state;
  value = parseFloat(value);
  if (isNaN(value)) return false;
  return value >= stateObj.from && value <= stateObj.to;
}

/**
 * Given a callout config and hass, resolve state_resolver and merge the correct preset.
 * @param {object} callout - The callout config (with state_resolver).
 * @param {object} presets - All available presets.
 * @param {object} hass - Home Assistant hass object.
 * @returns {object} stateOverrides to pass to resolveCalloutStyles
 */
export function resolveStatePreset(callout, presets, hass) {
  // Prefer state_resolver.entity/attribute over callout.entity/attribute
  const fallbackEntity = (callout.state_resolver && callout.state_resolver.entity) || callout.entity;
  const fallbackAttribute = (callout.state_resolver && callout.state_resolver.attribute) || callout.attribute;
  if (!callout || !callout.state_resolver || !Array.isArray(callout.state_resolver.states)) return {};
  for (const stateObj of callout.state_resolver.states) {
    if (entityMatchesRange(hass, stateObj, fallbackEntity, fallbackAttribute)) {
      const presetName = stateObj.preset;
      if (presetName && presets[presetName]) {
        return presets[presetName];
      }
    }
  }
  return {};
}