// Auto-register MSD v1 debug namespace & features.
// Import this file ONE TIME in your main card entry (e.g. src/index.js or the file that defines window.cblcars).
import './index.js';

// Optional: expose a convenience flag on window.cblcars for quick inspection.
if (typeof window !== 'undefined') {
  window.cblcars = window.cblcars || {};
  window.cblcars.msdv1 = window.cblcars.msdv1 || {
    ready: !!window.__msdDebug?.initMsdPipeline,
    enableFlag: 'MSD_V1_ENABLE'
  };
}
