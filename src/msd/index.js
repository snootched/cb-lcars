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
})();
