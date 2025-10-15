// Update the _loadPresetFromPacks method to be simpler and more reliable:

/**
 * Load preset from loaded packs via pipeline defaults manager
 * @private
 * @param {string} overlayType - Type of overlay (e.g., 'status_grid')
 * @param {string} presetName - Name of the preset
 * @returns {Object|null} Preset configuration or null if not found
 */
_loadPresetFromPacks(overlayType, presetName) {
  cblcarsLog.debug(`[StatusGridRenderer] 🔍 Loading preset ${presetName} for ${overlayType}`);

  // ENHANCED: Always check defaults manager first (should be loaded by now)
  const defaultsManager = this._resolveDefaultsManager();
  if (defaultsManager) {
    // Try to get preset through defaults system
    const presetPath = `${overlayType}.presets.${presetName}`;
    const preset = defaultsManager.resolve(presetPath);
    if (preset) {
      cblcarsLog.debug(`[StatusGridRenderer] ✅ Found preset ${presetName} via defaults manager`);
      return preset;
    }
  }

  // FALLBACK: Try to access pack data through pipeline instance
  const pipelineInstance = window.__msdDebug?.pipelineInstance;
  if (pipelineInstance && pipelineInstance.config && pipelineInstance.config.__provenance) {
    const mergeOrder = pipelineInstance.config.__provenance.merge_order;

    // Check pack layers for style presets
    for (const layer of mergeOrder) {
      if (layer.type === 'builtin') {
        try {
          const { loadBuiltinPacks } = window.loadBuiltinPacksModule || {};
          if (loadBuiltinPacks) {
            const packs = loadBuiltinPacks([layer.pack]);
            const pack = packs.find(p => p.id === layer.pack);

            if (pack && pack.style_presets && pack.style_presets[overlayType]) {
              const preset = pack.style_presets[overlayType][presetName];
              if (preset) {
                cblcarsLog.debug(`[StatusGridRenderer] ✅ Found preset ${presetName} in pack ${layer.pack} (pipeline fallback)`);
                return preset;
              }
            }
          }
        } catch (error) {
          cblcarsLog.debug(`[StatusGridRenderer] Could not load presets from pack ${layer.pack}:`, error.message);
        }
      }
    }
  }

  // LAST RESORT: Direct pack loading (should rarely be needed now)
  cblcarsLog.debug(`[StatusGridRenderer] Trying direct pack loading for preset ${presetName}`);
  try {
    const { loadBuiltinPacks } = window.loadBuiltinPacksModule || {};
    if (loadBuiltinPacks) {
      // Load the default packs directly
      const packs = loadBuiltinPacks(['core', 'cb_lcars_buttons']);

      for (const pack of packs) {
        if (pack && pack.style_presets && pack.style_presets[overlayType]) {
          const preset = pack.style_presets[overlayType][presetName];
          if (preset) {
            cblcarsLog.debug(`[StatusGridRenderer] ✅ Found preset ${presetName} in pack ${pack.id} (direct fallback)`);
            return preset;
          }
        }
      }
    }
  } catch (error) {
    cblcarsLog.debug(`[StatusGridRenderer] Direct pack loading failed:`, error.message);
  }

  // If we get here, preset wasn't found anywhere
  cblcarsLog.warn(`[StatusGridRenderer] ⚠️ Preset ${presetName} not found in any packs`);
  return null;
}

// Remove or simplify the _shouldWaitForPipeline method since we no longer need to wait:
_shouldWaitForPipeline(overlay) {
  // With the new sequencing, defaults should always be ready by the time overlays render
  // Keep basic safety check but don't schedule retries
  const defaultsManager = this._resolveDefaultsManager();
  if (!defaultsManager) {
    cblcarsLog.warn('[StatusGridRenderer] ⚠️ DefaultsManager not available - this should not happen with new sequencing');
    return true;
  }
  return false;
}