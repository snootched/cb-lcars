/**
 * Base SVG Filter Utilities
 * Provides CSS filter application and transition support for base SVG layers
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Generate CSS filter string from filter object
 * @param {Object} filters - Filter properties (opacity, blur, brightness, etc.)
 * @param {boolean} normalize - If true, include all filter properties with defaults for smooth transitions
 * @returns {string} CSS filter string
 */
export function generateFilterString(filters, normalize = false) {
  if (!filters || typeof filters !== 'object') {
    return normalize ? generateFilterString({}, true) : '';
  }

  // For smooth transitions, we need ALL filter properties present with their default values
  // This way CSS can interpolate between states properly
  const normalized = normalize ? {
    opacity: filters.opacity ?? 1,
    blur: filters.blur ?? '0px',
    brightness: filters.brightness ?? 1,
    contrast: filters.contrast ?? 1,
    saturate: filters.saturate ?? 1,
    hue_rotate: filters.hue_rotate ?? '0deg',
    grayscale: filters.grayscale ?? 0,
    sepia: filters.sepia ?? 0,
    invert: filters.invert ?? 0
  } : filters;

  const parts = [];

  // Order matters for visual quality - apply in logical sequence
  if (normalized.opacity !== undefined) {
    parts.push(`opacity(${normalized.opacity})`);
  }
  if (normalized.blur !== undefined) {
    parts.push(`blur(${normalized.blur})`);
  }
  if (normalized.brightness !== undefined) {
    parts.push(`brightness(${normalized.brightness})`);
  }
  if (normalized.contrast !== undefined) {
    parts.push(`contrast(${normalized.contrast})`);
  }
  if (normalized.saturate !== undefined) {
    parts.push(`saturate(${normalized.saturate})`);
  }
  if (normalized.hue_rotate !== undefined) {
    const hueValue = String(normalized.hue_rotate).endsWith('deg')
      ? normalized.hue_rotate
      : `${normalized.hue_rotate}deg`;
    parts.push(`hue-rotate(${hueValue})`);
  }
  if (normalized.grayscale !== undefined) {
    parts.push(`grayscale(${normalized.grayscale})`);
  }
  if (normalized.sepia !== undefined) {
    parts.push(`sepia(${normalized.sepia})`);
  }
  if (normalized.invert !== undefined) {
    parts.push(`invert(${normalized.invert})`);
  }

  return parts.join(' ');
}

/**
 * Apply filters to a base SVG element (typically #msd-base-content group)
 * @param {HTMLElement} svgElement - The SVG element/group to apply filters to
 * @param {Object} filters - Filter properties to apply
 * @param {number} [transition] - Transition duration in milliseconds (optional)
 */
export function applyBaseSvgFilters(svgElement, filters, transition) {
  if (!svgElement) {
    cblcarsLog.warn('[BaseSvgFilters] No SVG element provided');
    return;
  }

  cblcarsLog.trace('[BaseSvgFilters] 🎨 Applying filters to base content:', {
    element: svgElement.tagName,
    elementId: svgElement.id,
    filters,
    transition
  });

  // For transitions, normalize filters to include all properties with defaults
  // This allows CSS to smoothly interpolate between states
  const useNormalized = transition && transition > 0;
  const filterString = generateFilterString(filters, useNormalized);

  cblcarsLog.trace('[BaseSvgFilters] 🎨 Generated filter string:', filterString, useNormalized ? '(normalized for transition)' : '');

  // Apply transition if specified - MUST be set BEFORE changing the filter
  if (transition && transition > 0) {
    // Force a reflow to ensure transition is set before filter changes
    svgElement.style.transition = '';
    void svgElement.offsetHeight; // Force reflow

    svgElement.style.transition = `filter ${transition}ms ease-in-out`;

    // Use requestAnimationFrame to ensure transition is applied before filter change
    requestAnimationFrame(() => {
      // Apply the filter after transition is set
      svgElement.style.filter = filterString;

      cblcarsLog.debug('[BaseSvgFilters] ✅ Filter applied with transition to #' + (svgElement.id || 'element') + '. Current style.filter:', svgElement.style.filter);

      // Remove transition after it completes to avoid interfering with other updates
      setTimeout(() => {
        svgElement.style.transition = '';
      }, transition);
    });
  } else {
    // No transition - apply immediately
    svgElement.style.filter = filterString;
    cblcarsLog.debug('[BaseSvgFilters] ✅ Filter applied instantly to #' + (svgElement.id || 'element') + '. Current style.filter:', svgElement.style.filter);
  }
}

/**
 * Transition from current filters to new filters
 * @param {HTMLElement} svgElement - The SVG element
 * @param {Object} newFilters - New filter properties
 * @param {number} [duration=1000] - Transition duration in milliseconds
 * @returns {Promise} Resolves when transition completes
 */
export function transitionBaseSvgFilters(svgElement, newFilters, duration = 1000) {
  return new Promise((resolve) => {
    if (!svgElement) {
      cblcarsLog.warn('[BaseSvgFilters] No SVG element provided');
      resolve();
      return;
    }

    cblcarsLog.trace('[BaseSvgFilters] Starting transition to new filters:', { duration, filters: newFilters });

    // Apply transition with the specified duration
    applyBaseSvgFilters(svgElement, newFilters, duration);

    // Resolve after transition completes
    setTimeout(() => {
      cblcarsLog.trace('[BaseSvgFilters] Transition complete');
      resolve();
    }, duration);
  });
}

/**
 * Clear all filters from a base SVG element
 * @param {HTMLElement} svgElement - The SVG element
 * @param {number} [transition] - Optional transition duration in milliseconds
 */
export function clearBaseSvgFilters(svgElement, transition) {
  if (!svgElement) {
    return;
  }

  cblcarsLog.debug('[BaseSvgFilters] Clearing filters', { hasTransition: !!transition, transition });

  if (transition && transition > 0) {
    // Use normalized default filters for smooth transition to "no effect"
    const defaultFilters = generateFilterString({}, true);

    svgElement.style.transition = `filter ${transition}ms ease-in-out`;

    requestAnimationFrame(() => {
      svgElement.style.filter = defaultFilters;

      cblcarsLog.trace('[BaseSvgFilters] Cleared to default filters with transition');

      setTimeout(() => {
        svgElement.style.transition = '';
        // After transition, can optionally clear to empty string
        // But keeping normalized defaults is actually safer
      }, transition);
    });
  } else {
    svgElement.style.filter = '';
    cblcarsLog.trace('[BaseSvgFilters] Cleared filters instantly');
  }
}

/**
 * Get current computed filter values from an element
 * This is useful for debugging and state inspection
 * @param {HTMLElement} svgElement - The SVG element
 * @returns {string} Current filter string
 */
export function getCurrentFilters(svgElement) {
  if (!svgElement) {
    return '';
  }
  return svgElement.style.filter || '';
}

/**
 * Merge filter objects (useful for combining presets with overrides)
 * @param {Object} baseFilters - Base filter object
 * @param {Object} overrideFilters - Override filter object
 * @returns {Object} Merged filter object
 */
export function mergeFilters(baseFilters, overrideFilters) {
  return {
    ...baseFilters,
    ...overrideFilters
  };
}
