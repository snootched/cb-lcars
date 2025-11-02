/**
 * AnimationConfigProcessor - Processes animation configurations from YAML
 *
 * Responsibilities:
 * - Parse and validate animation_presets from merged config
 * - Process animations[] arrays on overlays
 * - Resolve preset_ref references to custom presets
 * - Validate animation configurations
 * - Prepare animation data for AnimationManager
 *
 * Called during pipeline configuration processing
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Process animation configuration from merged config
 *
 * @param {Object} mergedConfig - Merged YAML configuration
 * @returns {Object} Processed animation configuration
 */
export function processAnimationConfig(mergedConfig) {
  cblcarsLog.debug('[AnimationConfigProcessor] Processing animation configuration');
  cblcarsLog.debug('[AnimationConfigProcessor] mergedConfig keys:', Object.keys(mergedConfig));
  cblcarsLog.debug('[AnimationConfigProcessor] animation_presets:', mergedConfig.animation_presets);

  const processed = {
    customPresets: {},
    overlayAnimations: new Map(), // overlayId -> animations[]
    timelines: {},
    issues: [] // Validation issues
  };

  try {
    // 1. Process custom animation_presets
    if (mergedConfig.animation_presets) {
      processed.customPresets = processCustomPresets(mergedConfig.animation_presets, processed.issues);
      cblcarsLog.debug(`[AnimationConfigProcessor] Processed ${Object.keys(processed.customPresets).length} custom presets`);
    } else {
      cblcarsLog.warn('[AnimationConfigProcessor] No animation_presets found in mergedConfig');
    }

    // 2. Process overlay animations
    if (mergedConfig.overlays && Array.isArray(mergedConfig.overlays)) {
      mergedConfig.overlays.forEach(overlay => {
        if (overlay.animations && Array.isArray(overlay.animations)) {
          const processedAnimations = processOverlayAnimations(
            overlay.id,
            overlay.animations,
            processed.customPresets,
            processed.issues
          );

          if (processedAnimations.length > 0) {
            processed.overlayAnimations.set(overlay.id, processedAnimations);
          }
        }
      });

      cblcarsLog.debug(`[AnimationConfigProcessor] Processed animations for ${processed.overlayAnimations.size} overlays`);
    }

    // 3. Process timeline configurations
    if (mergedConfig.timelines) {
      processed.timelines = processTimelines(
        mergedConfig.timelines,
        processed.customPresets,
        processed.issues
      );

      cblcarsLog.debug(`[AnimationConfigProcessor] Processed ${Object.keys(processed.timelines).length} timelines`);
    }

    // 4. Log any validation issues
    if (processed.issues.length > 0) {
      cblcarsLog.warn('[AnimationConfigProcessor] ⚠️ Validation issues found:', processed.issues);
    }

    cblcarsLog.info('[AnimationConfigProcessor] ✅ Animation configuration processed', {
      customPresets: Object.keys(processed.customPresets).length,
      overlaysWithAnimations: processed.overlayAnimations.size,
      timelines: Object.keys(processed.timelines).length,
      issues: processed.issues.length
    });

  } catch (error) {
    cblcarsLog.error('[AnimationConfigProcessor] Failed to process animation config:', error);
    processed.issues.push({
      severity: 'error',
      message: `Failed to process animation configuration: ${error.message}`
    });
  }

  return processed;
}

/**
 * Process custom animation presets
 *
 * @param {Object} presetsConfig - animation_presets from YAML
 * @param {Array} issues - Array to collect validation issues
 * @returns {Object} Processed custom presets
 */
function processCustomPresets(presetsConfig, issues = []) {
  const processed = {};

  Object.entries(presetsConfig).forEach(([presetName, presetDef]) => {
    // Validate preset name
    if (!presetName || typeof presetName !== 'string') {
      issues.push({
        severity: 'error',
        message: 'Custom preset must have a valid string name',
        preset: presetName
      });
      return;
    }

    // Validate preset definition
    if (!presetDef || typeof presetDef !== 'object') {
      issues.push({
        severity: 'error',
        message: `Custom preset "${presetName}" must be an object`,
        preset: presetName
      });
      return;
    }

    // Check if extending a built-in preset
    // Support both 'type' and 'preset' for backwards compatibility
    const basePresetName = presetDef.preset || presetDef.type;
    if (basePresetName) {
      const builtinPresets = window.cblcars?.anim?.presets || {};
      if (!builtinPresets[basePresetName]) {
        issues.push({
          severity: 'warning',
          message: `Custom preset "${presetName}" extends unknown built-in preset: ${basePresetName}`,
          preset: presetName
        });
      } else {
        // Store the base preset reference
        processed[presetName] = {
          ...presetDef,
          _basePreset: basePresetName
        };
        cblcarsLog.debug(`[AnimationConfigProcessor] Custom preset "${presetName}" extends "${basePresetName}"`);
        return;
      }
    }

    processed[presetName] = { ...presetDef };
  });

  return processed;
}

/**
 * Process animations for a single overlay
 *
 * @param {string} overlayId - Overlay identifier
 * @param {Array} animations - animations[] array from overlay config
 * @param {Object} customPresets - Processed custom presets
 * @param {Array} issues - Array to collect validation issues
 * @returns {Array} Processed animation definitions
 */
function processOverlayAnimations(overlayId, animations, customPresets, issues = []) {
  const processed = [];

  animations.forEach((animDef, index) => {
    // Validate animation definition
    if (!animDef || typeof animDef !== 'object') {
      issues.push({
        severity: 'error',
        message: `Animation ${index} for overlay "${overlayId}" must be an object`,
        overlayId
      });
      return;
    }

    // Must have either preset or preset_ref
    if (!animDef.preset && !animDef.preset_ref) {
      issues.push({
        severity: 'error',
        message: `Animation ${index} for overlay "${overlayId}" must specify either "preset" or "preset_ref"`,
        overlayId,
        animation: animDef
      });
      return;
    }

    // Validate preset_ref if used
    if (animDef.preset_ref && !customPresets[animDef.preset_ref]) {
      issues.push({
        severity: 'error',
        message: `Animation ${index} for overlay "${overlayId}" references unknown preset: ${animDef.preset_ref}`,
        overlayId,
        preset_ref: animDef.preset_ref
      });
      return;
    }

    // Validate preset if used
    if (animDef.preset) {
      const builtinPresets = window.cblcars?.anim?.presets || {};
      if (!builtinPresets[animDef.preset] && !customPresets[animDef.preset]) {
        issues.push({
          severity: 'warning',
          message: `Animation ${index} for overlay "${overlayId}" uses unknown preset: ${animDef.preset}`,
          overlayId,
          preset: animDef.preset
        });
      }
    }

    // Validate trigger
    const validTriggers = [
      'on_load',
      'on_tap',
      'on_hover',
      'on_leave',         // ✨ NEW: Phase 1.5 - stops hover animations
      'on_double_tap',    // Already supported in Phase 1
      'on_hold',
      'on_redraw',
      'on_exit',
      'on_datasource_change'  // ✨ NEW: Phase 2 - reactive animations
    ];

    if (animDef.trigger && !validTriggers.includes(animDef.trigger)) {
      issues.push({
        severity: 'warning',
        message: `Animation ${index} for overlay "${overlayId}" uses unknown trigger: ${animDef.trigger}`,
        overlayId,
        trigger: animDef.trigger,
        validTriggers
      });
    }

    // ✨ NEW: Phase 2 - Validate datasource property for on_datasource_change
    if (animDef.trigger === 'on_datasource_change') {
      if (!animDef.datasource) {
        issues.push({
          severity: 'error',
          message: `Animation ${index} for overlay "${overlayId}" uses on_datasource_change but missing 'datasource' property`,
          overlayId,
          animationIndex: index
        });
      }
    }

    // ✨ NEW: Phase 2 - Warn about deprecated 'when' property
    if (animDef.when) {
      issues.push({
        severity: 'warning',
        message: `Animation ${index} for overlay "${overlayId}" uses 'when' property - conditions should be defined in rules instead. This property will be ignored.`,
        overlayId,
        animationIndex: index,
        suggestion: 'Move conditions to a rule in the rules section with apply.overlays[].animations'
      });
    }

    // Add default trigger if not specified
    const processedDef = {
      trigger: 'on_load',
      ...animDef
    };

    processed.push(processedDef);
  });

  return processed;
}

/**
 * Process timeline configurations
 *
 * @param {Object} timelinesConfig - timelines from YAML
 * @param {Object} customPresets - Processed custom presets
 * @param {Array} issues - Array to collect validation issues
 * @returns {Object} Processed timeline configurations
 */
function processTimelines(timelinesConfig, customPresets, issues = []) {
  const processed = {};

  Object.entries(timelinesConfig).forEach(([timelineId, timelineConfig]) => {
    // Validate timeline ID
    if (!timelineId || typeof timelineId !== 'string') {
      issues.push({
        severity: 'error',
        message: 'Timeline must have a valid string ID'
      });
      return;
    }

    // Validate timeline config
    if (!timelineConfig || typeof timelineConfig !== 'object') {
      issues.push({
        severity: 'error',
        message: `Timeline "${timelineId}" must be an object`,
        timelineId
      });
      return;
    }

    // Validate steps
    if (!timelineConfig.steps || !Array.isArray(timelineConfig.steps)) {
      issues.push({
        severity: 'error',
        message: `Timeline "${timelineId}" must have a "steps" array`,
        timelineId
      });
      return;
    }

    // Process timeline steps
    const processedSteps = timelineConfig.steps.map((step, index) => {
      // Validate step
      if (!step || typeof step !== 'object') {
        issues.push({
          severity: 'error',
          message: `Timeline "${timelineId}" step ${index} must be an object`,
          timelineId,
          step: index
        });
        return null;
      }

      // Must have overlay_id
      if (!step.overlay_id) {
        issues.push({
          severity: 'error',
          message: `Timeline "${timelineId}" step ${index} must have "overlay_id"`,
          timelineId,
          step: index
        });
        return null;
      }

      // Validate preset_ref if used
      if (step.preset_ref && !customPresets[step.preset_ref]) {
        issues.push({
          severity: 'warning',
          message: `Timeline "${timelineId}" step ${index} references unknown preset: ${step.preset_ref}`,
          timelineId,
          step: index,
          preset_ref: step.preset_ref
        });
      }

      return step;
    }).filter(Boolean); // Remove invalid steps

    processed[timelineId] = {
      ...timelineConfig,
      steps: processedSteps
    };
  });

  return processed;
}

/**
 * Validate animation parameters
 *
 * @param {Object} animDef - Animation definition
 * @returns {Array} Array of validation issues
 */
export function validateAnimationParams(animDef) {
  const issues = [];

  // Check duration
  if (animDef.duration !== undefined) {
    if (typeof animDef.duration !== 'number' || animDef.duration <= 0) {
      issues.push({
        severity: 'warning',
        message: 'Animation duration must be a positive number',
        param: 'duration',
        value: animDef.duration
      });
    }
  }

  // Check loop
  if (animDef.loop !== undefined && typeof animDef.loop !== 'boolean') {
    issues.push({
      severity: 'warning',
      message: 'Animation loop must be a boolean',
      param: 'loop',
      value: animDef.loop
    });
  }

  // Check alternate
  if (animDef.alternate !== undefined && typeof animDef.alternate !== 'boolean') {
    issues.push({
      severity: 'warning',
      message: 'Animation alternate must be a boolean',
      param: 'alternate',
      value: animDef.alternate
    });
  }

  return issues;
}

/**
 * Get list of available presets (built-in + custom)
 *
 * @param {Object} customPresets - Custom presets from config
 * @returns {Object} { builtin: [...], custom: [...] }
 */
export function getAvailablePresets(customPresets = {}) {
  const builtinPresets = Object.keys(window.cblcars?.anim?.presets || {});
  const customPresetNames = Object.keys(customPresets);

  return {
    builtin: builtinPresets,
    custom: customPresetNames,
    all: [...builtinPresets, ...customPresetNames]
  };
}
