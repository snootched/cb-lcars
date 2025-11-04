/**
 * Animation Presets - Modernized MSD System
 *
 * Ported from legacy cb-lcars-anim-presets.js with modernizations:
 * - No direct DOM manipulation (handled by AnimationManager target resolution)
 * - Clean separation of anime.js params and element styles
 * - Support for multi-target animations via AnimationManager
 * - Simplified configuration with smart defaults
 *
 * Each preset returns:
 * {
 *   anime: { ...anime.js parameters },
 *   styles: { ...CSS properties to set on target(s) }
 * }
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { deepMerge } from '../util/deepMerge.js';

const _presets = new Map();

/**
 * Register an animation preset
 * @param {string} name - Preset name
 * @param {Function} builder - Preset function that returns {anime, styles}
 */
export function registerAnimationPreset(name, builder) {
  _presets.set(name, builder);
  cblcarsLog.debug(`[AnimationPresets] Registered preset: ${name}`);
}

/**
 * Get an animation preset by name
 * @param {string} name - Preset name
 * @returns {Function|null} Preset function or null if not found
 */
export function getAnimationPreset(name) {
  return _presets.get(name);
}

/**
 * List all registered preset names
 * @returns {string[]} Array of preset names
 */
export function listAnimationPresets() {
  return Array.from(_presets.keys());
}

/**
 * Merge animation parameters
 * @param {Object} base - Base parameters
 * @param {Object} override - Override parameters
 * @returns {Object} Merged parameters
 */
export function mergeAnimationParams(base, override) {
  return deepMerge({ ...(base || {}) }, override || {});
}

// ==============================================================================
// CORE ANIMATION PRESETS
// ==============================================================================

/**
 * Pulse - Breathing effect with scale/opacity
 *
 * Smart behaviors handled by AnimationManager target resolution:
 * - Text overlays: Animate text element (not wrapper)
 * - Button overlays: Animate entire button (default) or specific text elements
 *
 * Parameters:
 * - max_scale (default: 1.2) or scale
 * - min_opacity (default: 0.7)
 * - duration (default: 1200)
 * - easing (default: 'easeInOutSine')
 * - loop (default: true)
 * - alternate (default: true)
 */
registerAnimationPreset('pulse', (def) => {
  const p = def.params || def;
  const maxScale = p.max_scale !== undefined ? p.max_scale : (p.scale !== undefined ? p.scale : 1.2);
  const minOpacity = p.min_opacity !== undefined ? p.min_opacity : 0.7;
  const duration = p.duration || 1200;
  const easing = p.easing || 'easeInOutSine';
  const loop = p.loop !== undefined ? p.loop : true;
  const alternate = p.alternate !== undefined ? p.alternate : true;

  return {
    anime: {
      scale: [1, maxScale],
      opacity: [minOpacity, 1],
      duration,
      easing,
      loop,
      direction: alternate ? 'alternate' : 'normal'
    },
    styles: {
      transformOrigin: 'center',
      transformBox: 'fill-box'
    }
  };
});

/**
 * Fade - Simple opacity transition
 *
 * Parameters:
 * - from (default: 0)
 * - to (default: 1)
 * - duration (default: 1000)
 * - easing (default: 'linear')
 * - loop (default: false)
 * - alternate (default: false)
 */
registerAnimationPreset('fade', (def) => {
  const p = def.params || def;
  const from = p.from !== undefined ? p.from : 0;
  const to = p.to !== undefined ? p.to : 1;
  const duration = p.duration || 1000;
  const easing = p.easing || 'linear';
  const loop = p.loop || false;
  const alternate = p.alternate || false;

  return {
    anime: {
      opacity: [from, to],
      duration,
      easing,
      loop,
      direction: alternate ? 'alternate' : 'normal'
    },
    styles: {}
  };
});

/**
 * Glow - Animated drop-shadow effect
 *
 * Parameters:
 * - color (default: 'var(--lcars-blue)' or '#66ccff')
 * - glow_color (alias for color)
 * - blur_min (default: 0)
 * - blur_max (default: 10)
 * - duration (default: 1500)
 * - easing (default: 'easeInOutSine')
 * - loop (default: true)
 * - alternate (default: true)
 */
registerAnimationPreset('glow', (def) => {
  const p = def.params || def;
  const color = p.color || p.glow_color || 'var(--lcars-blue, #66ccff)';
  const blurMin = p.blur_min !== undefined ? p.blur_min : 0;
  const blurMax = p.blur_max !== undefined ? p.blur_max : 10;
  const duration = p.duration || 1500;
  const easing = p.easing || 'easeInOutSine';
  const loop = p.loop !== undefined ? p.loop : true;
  const alternate = p.alternate !== undefined ? p.alternate : true;

  return {
    anime: {
      filter: [
        `drop-shadow(0 0 ${blurMin}px ${color})`,
        `drop-shadow(0 0 ${blurMax}px ${color})`
      ],
      duration,
      easing,
      loop,
      direction: alternate ? 'alternate' : 'normal'
    },
    styles: {}
  };
});

/**
 * Draw - SVG path drawing animation
 * Uses anime.js strokeDashoffset for path drawing
 *
 * Parameters:
 * - duration (default: 2000)
 * - easing (default: 'linear')
 * - reverse (default: false)
 * - loop (default: false)
 * - alternate (default: false)
 */
registerAnimationPreset('draw', (def) => {
  const p = def.params || def;
  const duration = p.duration || 2000;
  const easing = p.easing || 'linear';
  const reverse = p.reverse || false;
  const loop = p.loop || false;
  const alternate = p.alternate || false;

  return {
    anime: {
      strokeDashoffset: reverse ? [0, anime => anime.setDashoffset] : [anime => anime.setDashoffset, 0],
      duration,
      easing,
      loop,
      direction: alternate ? 'alternate' : 'normal'
    },
    styles: {}
  };
});

/**
 * March - CSS-based marching dashed line animation
 * More performant than anime.js for continuous animations
 *
 * Parameters:
 * - dash_length (default: 10)
 * - gap_length (default: 5)
 * - speed (default: 2) - seconds per cycle
 * - direction (default: 'forward')
 */
registerAnimationPreset('march', (def) => {
  const p = def.params || def;
  const dashLength = p.dash_length || 10;
  const gapLength = p.gap_length || 5;
  const speed = p.speed || 2;
  const direction = p.direction || 'forward';

  const totalLength = dashLength + gapLength;
  const animationName = direction === 'reverse' ? 'march-reverse' : 'march';

  // Return CSS animation config (handled specially by animateElement)
  return {
    anime: {
      // Special marker for CSS animation
      _cssAnimation: true,
      animationName,
      duration: speed * 1000
    },
    styles: {
      'stroke-dasharray': `${dashLength} ${gapLength}`,
      'stroke-dashoffset': direction === 'reverse' ? totalLength : 0,
      animation: `${animationName} ${speed}s linear infinite`
    }
  };
});

// ==============================================================================
// VISUAL EFFECT PRESETS
// ==============================================================================

/**
 * Blink - Rapid opacity toggle
 *
 * Parameters:
 * - max_opacity (default: 1)
 * - min_opacity (default: 0.3)
 * - duration (default: 1200)
 * - easing (default: 'linear')
 * - loop (default: true)
 * - alternate (default: true)
 */
registerAnimationPreset('blink', (def) => {
  const p = def.params || def;
  const maxOpacity = p.max_opacity !== undefined ? p.max_opacity : 1;
  const minOpacity = p.min_opacity !== undefined ? p.min_opacity : 0.3;
  const duration = p.duration || 1200;
  const easing = p.easing || 'linear';
  const loop = p.loop !== undefined ? p.loop : true;
  const alternate = p.alternate !== undefined ? p.alternate : true;

  return {
    anime: {
      opacity: [maxOpacity, minOpacity],
      duration,
      easing,
      loop,
      direction: alternate ? 'alternate' : 'normal'
    },
    styles: {}
  };
});

/**
 * Shimmer - Fill color + opacity animation
 *
 * Parameters:
 * - color_from (default: element's current fill)
 * - color_to (required) or shimmer_color
 * - opacity_from (default: 1)
 * - opacity_to (default: 0.5)
 * - duration (default: 1500)
 * - easing (default: 'easeInOutSine')
 * - loop (default: true)
 * - alternate (default: true)
 */
registerAnimationPreset('shimmer', (def) => {
  const p = def.params || def;
  const colorFrom = p.color_from || 'currentColor';
  const colorTo = p.color_to || p.shimmer_color || '#ffffff';
  const opacityFrom = p.opacity_from !== undefined ? p.opacity_from : 1;
  const opacityTo = p.opacity_to !== undefined ? p.opacity_to : 0.5;
  const duration = p.duration || 1500;
  const easing = p.easing || 'easeInOutSine';
  const loop = p.loop !== undefined ? p.loop : true;
  const alternate = p.alternate !== undefined ? p.alternate : true;

  return {
    anime: {
      fill: [colorFrom, colorTo],
      opacity: [opacityFrom, opacityTo],
      duration,
      easing,
      loop,
      direction: alternate ? 'alternate' : 'normal'
    },
    styles: {}
  };
});

/**
 * Strobe - Fast opacity strobe effect
 *
 * Parameters:
 * - duration (default: 100)
 * - max_opacity (default: 1)
 * - min_opacity (default: 0)
 * - easing (default: 'linear')
 * - loop (default: true)
 * - alternate (default: true)
 */
registerAnimationPreset('strobe', (def) => {
  const p = def.params || def;
  const duration = p.duration || 100;
  const maxOpacity = p.max_opacity !== undefined ? p.max_opacity : 1;
  const minOpacity = p.min_opacity !== undefined ? p.min_opacity : 0;
  const easing = p.easing || 'linear';
  const loop = p.loop !== undefined ? p.loop : true;
  const alternate = p.alternate !== undefined ? p.alternate : true;

  return {
    anime: {
      opacity: [maxOpacity, minOpacity],
      duration,
      easing,
      loop,
      direction: alternate ? 'alternate' : 'normal'
    },
    styles: {}
  };
});

/**
 * Flicker - Randomized opacity animation
 *
 * Parameters:
 * - max_opacity (default: 1)
 * - min_opacity (default: 0.3)
 * - duration (default: 1000)
 * - easing (default: 'linear')
 * - loop (default: true)
 */
registerAnimationPreset('flicker', (def) => {
  const p = def.params || def;
  const maxOpacity = p.max_opacity !== undefined ? p.max_opacity : 1;
  const minOpacity = p.min_opacity !== undefined ? p.min_opacity : 0.3;
  const duration = p.duration || 1000;
  const easing = p.easing || 'linear';
  const loop = p.loop !== undefined ? p.loop : true;

  // Generate random opacity keyframes
  const keyframes = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const randomOpacity = minOpacity + Math.random() * (maxOpacity - minOpacity);
    keyframes.push({ opacity: randomOpacity });
  }

  return {
    anime: {
      keyframes,
      duration,
      easing,
      loop
    },
    styles: {}
  };
});

/**
 * Cascade - Staggered animation for multiple targets
 *
 * Parameters:
 * - stagger (default: 100) - ms delay between elements
 * - property (default: 'opacity')
 * - from (default: 0)
 * - to (default: 1)
 * - duration (default: 1000)
 * - easing (default: 'easeOutExpo')
 * - loop (default: false)
 */
registerAnimationPreset('cascade', (def) => {
  const p = def.params || def;
  const stagger = p.stagger || 100;
  const property = p.property || 'opacity';
  const from = p.from !== undefined ? p.from : 0;
  const to = p.to !== undefined ? p.to : 1;
  const duration = p.duration || 1000;
  const easing = p.easing || 'easeOutExpo';
  const loop = p.loop || false;

  return {
    anime: {
      [property]: [from, to],
      duration,
      easing,
      delay: window.cblcars?.anim?.stagger?.(stagger) || stagger,
      loop
    },
    styles: {}
  };
});

/**
 * Ripple - Expanding scale + opacity effect
 *
 * Parameters:
 * - scale_max (default: 1.5)
 * - opacity_min (default: 0)
 * - duration (default: 1000)
 * - easing (default: 'easeOutExpo')
 * - loop (default: false)
 */
registerAnimationPreset('ripple', (def) => {
  const p = def.params || def;
  const scaleMax = p.scale_max !== undefined ? p.scale_max : 1.5;
  const opacityMin = p.opacity_min !== undefined ? p.opacity_min : 0;
  const duration = p.duration || 1000;
  const easing = p.easing || 'easeOutExpo';
  const loop = p.loop || false;

  return {
    anime: {
      scale: [1, scaleMax],
      opacity: [1, opacityMin],
      duration,
      easing,
      loop
    },
    styles: {
      transformOrigin: 'center',
      transformBox: 'fill-box'
    }
  };
});

// ==============================================================================
// UTILITY PRESETS
// ==============================================================================

/**
 * Set - Immediately set properties without animation
 *
 * Parameters:
 * - properties (object) - CSS properties to set
 *
 * Example:
 *   { preset: 'set', properties: { opacity: 0.5, fill: 'red' } }
 */
registerAnimationPreset('set', (def) => {
  const p = def.params || def;
  const properties = p.properties || {};

  return {
    anime: {
      // Duration 0 = immediate
      duration: 0,
      ...properties
    },
    styles: {}
  };
});

/**
 * Motionpath - Path following animation (placeholder)
 * TODO: Implement full motionpath support with anime.js v4
 *
 * Parameters:
 * - duration (default: 4000)
 * - easing (default: 'linear')
 * - loop (default: true)
 * - path_selector (required) - CSS selector for path element
 */
registerAnimationPreset('motionpath', (def) => {
  const p = def.params || def;
  const duration = p.duration || 4000;
  const easing = p.easing || 'linear';
  const loop = p.loop !== undefined ? p.loop : true;

  // Placeholder implementation
  // TODO: Add anime.js v4 createMotionPath() support
  cblcarsLog.warn('[AnimationPresets] Motionpath preset is a placeholder - full implementation pending');

  return {
    anime: {
      duration,
      easing,
      loop,
      update: p.update
    },
    styles: {},
    postInit(instance, ctx) {
      // Future: attach tracer element along path if p.tracer defined
      void instance;
      void ctx;
    }
  };
});
