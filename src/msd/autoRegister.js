console.error('!!! auto-register attempted !!!')



/**
 * Auto-registration file to ensure all Phase 1-4 systems are available
 * Import this file to make refactored systems available globally
 */

/*
// Import and expose all refactored systems
import { AdvancedRenderer } from './renderer/AdvancedRenderer.js';
import { MsdDebugRenderer } from './debug/MsdDebugRenderer.js';
import { MsdIntrospection } from './introspection/MsdIntrospection.js';
import { MsdHudManager } from './hud/MsdHudManager.js';
import { MsdControlsRenderer } from './controls/MsdControlsRenderer.js';
import { MsdApi } from './api/MsdApi.js';

// Ensure global availability
if (typeof window !== 'undefined') {
  window.__msdRefactored = {
    AdvancedRenderer,
    MsdDebugRenderer,
    MsdIntrospection,
    MsdHudManager,
    MsdControlsRenderer,
    MsdApi
  };
}

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
*/