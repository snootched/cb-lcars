import { initMsdPipeline, initMsdHud } from './pipeline/PipelineCore.js';
import { processMsdConfig } from './pipeline/ConfigProcessor.js';
import { mergePacks, validateMerged } from './pipeline/ConfigProcessor.js';
import { buildCardModel } from './model/CardModel.js';

import "./hud/hudService.js";

// Main exports
export { initMsdPipeline, processMsdConfig };

// Utility exports
export { mergePacks, validateMerged };

// Debug exposure
(function attachDebug() {
  if (typeof window === 'undefined') return;

  window.__msdDebug = window.__msdDebug || {};
  Object.assign(window.__msdDebug, {
    mergePacks,
    buildCardModel,
    initMsdPipeline
  });

  // Enhanced debug interface
  Object.assign(window.__msdDebug, {
    // Authoritative pipeline instance
    pipelineInstance: null,

    // Initialize MSD pipeline
    async initMsdPipeline(mergedConfig, mount, hass) {
      try {
        const pipelineApi = await initMsdPipeline(mergedConfig, mount, hass);

        // Set the authoritative pipelineInstance property
        this.pipelineInstance = pipelineApi;

        return pipelineApi;
      } catch (error) {
        console.error('[MSD Debug] Pipeline initialization failed:', error);
        throw error;
      }
    }
  });

  // DataSourceManager property with getter
  Object.defineProperty(window.__msdDebug, 'dataSourceManager', {
    get() {
      // Simplified: Use pipelineInstance as single source of truth
      return window.__msdDebug.pipelineInstance?.dataSourceManager ||
             window.__msdDebug.pipelineInstance?.systemsManager?.dataSourceManager;
    },
    configurable: true  // Allow it to be redefined if needed
  });
})();


