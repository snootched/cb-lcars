////import anime from 'animejs';
//console.log('anime import:', anime);

/*
export function animateElement({targets, ...opts}) {
  // targets: selector, element, or array
  (anime.default || anime)({
    targets,
    ...opts
  });
}
*/

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


/////this function works as a base... before doing work on cfg
// Animate helper: waits for targets and anime.js, then animates
export function animateElement({ targets, root = document, ...opts }) {
  const allTargets = Array.isArray(targets) ? targets : [targets];
  console.warn("animateElement called with targets:", allTargets, "root:", root, "opts:", opts);
  Promise.all([
    waitForElement(allTargets, root)
  ])
    //.then(([/*foundEls*/, /*animeFn*/]) => {
    .then(([]) => {
      // Use the global resolveAnimationTargets (imported from overlay-helpers)
      const realTargets = resolveAnimationTargets(allTargets, root);
      console.log("Targets resolved:", realTargets);
      console.log("Animation options:", opts);
      console.log("root:", root);


      if (realTargets.length && typeof window.cblcars.anime === "function") {
        console.warn("Animating with targets:", realTargets, "options:", opts);
        const animInstance = window.cblcars.anime(realTargets, {...opts });
        console.log("anime.js animation instance:", animInstance);

      } else {
        throw new Error("anime.js not loaded or no targets resolved");
      }
    })
    .catch((err) => {
      // Optionally log or handle error
      console.warn("Animation skipped:", err);
    });
}





// Animate helper: waits for targets and anime.js, then animates
export function animateElement2({ targets, root = document, ...opts }) {
  const allTargets = Array.isArray(targets) ? targets : [targets];
  console.warn("animateElement called with targets:", allTargets, "root:", root, "opts:", opts);
  Promise.all([
    waitForElement(allTargets, root)
 //   waitForElement(allTargets, root),
 //   waitForAnimeJs()
  ])
    .then(([/*foundEls*/, /*animeFn*/]) => {
      // Use the global resolveAnimationTargets (imported from overlay-helpers)
      const realTargets = resolveAnimationTargets(allTargets, root);
      console.log("Targets resolved:", realTargets);
      console.log("Animation options:", opts);
      console.log("root:", root);


      if (realTargets.length && typeof window.cblcars.anime === "function") {
        console.warn("Animating with targets:", realTargets, "options:", opts);
        const animInstance = window.cblcars.anime(realTargets, {...opts });
        console.log("anime.js animation instance:", animInstance);

      } else {
        throw new Error("anime.js not loaded or no targets resolved");
      }
    })
    .catch((err) => {
      // Optionally log or handle error
      console.warn("Animation skipped:", err);
    });
}
