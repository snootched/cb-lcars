// Helper to resolve targets (selectors, elements, arrays) to a flat array of elements
import { resolveAnimationTargets } from './cb-lcars-overlay-helpers.js';

// Wait for an element or multiple selectors/elements
export function waitForElement(targets, context, timeout = 2000, interval = 50) {
  return new Promise((resolve, reject) => {
    console.warn("waitForElement called with targets:", targets, "context:", context);
    //if (!targets) return resolve([]); // No targets, resolve immediately
    const start = Date.now();
    const allTargets = Array.isArray(targets) ? targets : [targets];
    function check() {
      let allFound = true;
      let foundEls = [];
      for (const t of allTargets) {
        let els = [];
        if (typeof t === 'string') {
          // Use context.shadowRoot if present, else context, else document
          let root = context?.shadowRoot || context || document;
          els = root.querySelectorAll(t);
          //els = (context?.shadowRoot || document).querySelectorAll(t);
        } else if (t instanceof Element) {
          els = [t];
        }
        if (!els.length) allFound = false;
        foundEls.push(...els);
      }
      if (allFound) {
        console.warn("waitForElement found targets:", foundEls);
        return resolve(foundEls);
        }
      if (Date.now() - start > timeout) return reject(new Error('Timeout waiting for targets'));
      setTimeout(check, interval);
    }
    check();
  });
}


// Animation type presets for anime.js v4+
const animationPresets = {
  blink: (cfg = {}) => ({
    opacity: [
      { value: 1, duration: (cfg.duration || 1500) / 2 },
      { value: 0.3, duration: (cfg.duration || 1500) / 2 }
    ],
    loop: true,
    direction: 'alternate',
    easing: cfg.easing || 'linear',
    duration: cfg.duration || 1500,
    ...cfg
  }),
  march: (cfg = {}) => ({
    strokeDashoffset: [
      { value: 0, duration: (cfg.duration || 2000) / 2 },
      { value: 100, duration: (cfg.duration || 2000) / 2 }
    ],
    loop: true,
    easing: cfg.easing || 'linear',
    duration: cfg.duration || 2000,
    ...cfg
  }),
  pulse: (cfg = {}) => ({
    scale: [
      { value: 1, duration: (cfg.duration || 1200) / 2 },
      { value: 1.2, duration: (cfg.duration || 1200) / 2 }
    ],
    loop: true,
    direction: 'alternate',
    easing: cfg.easing || 'easeInOutQuad',
    duration: cfg.duration || 1200,
    ...cfg
  }),
  // Add more types as needed...
};

// Animate helper: waits for targets and anime.js, then animates
export function animateElement({ targets, root = document, engine = 'anime', type, ...opts }) {
  const allTargets = Array.isArray(targets) ? targets : [targets];

  // Expand type-based presets if present
  let finalOpts = { ...opts };
  if (type && animationPresets[type]) {
    finalOpts = animationPresets[type]({ ...opts, type });
  }

  // Prefer anime.js unless engine is explicitly 'css'
  if (engine === 'css') {
    // CSS keyframes: just add class to targets (assume opts.className is provided)
    waitForElement(allTargets, root).then(foundEls => {
      if (finalOpts.className) {
        foundEls.forEach(el => el.classList.add(finalOpts.className));
      }
    }).catch(err => {
      console.warn("CSS animation skipped:", err);
    });
    return;
  }

  // anime.js v4+ logic
  Promise.all([
    waitForElement(allTargets, root)
  ])
    .then(([]) => {
      const realTargets = resolveAnimationTargets(allTargets, root);
      if (realTargets.length && typeof window.cblcars.anime === "function") {
        // anime.js v4+: anime(targets, options)
        window.cblcars.anime(realTargets, finalOpts);
      } else {
        throw new Error("anime.js not loaded or no targets resolved");
      }
    })
    .catch((err) => {
      console.warn("Animation skipped:", err);
    });
}

