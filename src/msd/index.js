import { isMsdV1Enabled, MSD_V1_ENABLE } from './featureFlags.js';
import { initMsdPipeline, initMsdHud } from './pipeline/PipelineCore.js';
import { processMsdConfig } from './pipeline/ConfigProcessor.js';
import { mergePacks, validateMerged } from './pipeline/ConfigProcessor.js';
import { buildCardModel } from './model/CardModel.js';

// Import tests and services
import "./tests/routingScenarios.js"
import "./tests/smartRoutingScenarios.js"
import "./tests/channelsRoutingScenarios.js"
import "./tests/arcsRoutingScenarios.js";
import "./tests/smoothingRoutingScenarios.js";
import "./hud/hudService.js";

// Main exports
export { initMsdPipeline, initMsdHud, processMsdConfig };

// Utility exports
export { mergePacks, validateMerged };

// Debug exposure
(function attachDebug() {
  if (typeof window === 'undefined') return;

  window.__msdDebug = window.__msdDebug || {};
  Object.assign(window.__msdDebug, {
    mergePacks,
    buildCardModel,
    initMsdPipeline,
    initMsdHud
  });

  window.__msdDebug.featureFlags = window.__msdDebug.featureFlags || {};
  window.__msdDebug.featureFlags.MSD_V1_ENABLE = MSD_V1_ENABLE;

  // Enhanced debug interface
  Object.assign(window.__msdDebug, {
    // FIXED: Use pipelineInstance instead of pipeline property
    pipelineInstance: null,

    // Enhanced pipeline access with getter that doesn't conflict
    get pipeline() {
      return this.pipelineInstance;
    },

    // Initialize MSD pipeline
    async initMsdPipeline(mergedConfig, mount, hass) {
      try {
        const pipelineApi = await initMsdPipeline(mergedConfig, mount, hass);

        // FIXED: Set the pipelineInstance property instead of pipeline
        this.pipelineInstance = pipelineApi;

        return pipelineApi;
      } catch (error) {
        console.error('[MSD Debug] Pipeline initialization failed:', error);
        throw error;
      }
    }
  });

  // FIXED: Only define getters AFTER we've confirmed they don't conflict
  // Check if dataSources property already exists before creating getter
  if (!window.__msdDebug.hasOwnProperty('dataSources')) {
    // DataSources property with getter
    Object.defineProperty(window.__msdDebug, 'dataSources', {
      get() {
        const dsManager = window.__msdDebug.dataSourceManager;
        if (!dsManager) {
          return {
            stats: () => ({ error: 'DataSourceManager not available' })
          };
        }

        return {
          stats: () => dsManager.getStats(),
          manager: dsManager,
          listIds: () => dsManager.listIds(),
          getEntity: (id) => dsManager.getEntity(id)
        };
      },
      configurable: true  // Allow it to be redefined if needed
    });
  }

  // Check if dataSourceManager property already exists before creating getter
  if (!window.__msdDebug.hasOwnProperty('dataSourceManager')) {
    // DataSourceManager property with getter
    Object.defineProperty(window.__msdDebug, 'dataSourceManager', {
      get() {
        return window.__msdDebug.pipelineInstance?.dataSourceManager ||
               window.__msdDebug.pipelineInstance?.systemsManager?.dataSourceManager;
      },
      configurable: true  // Allow it to be redefined if needed
    });
  }
})();
