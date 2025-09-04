import { mergePacks } from '../packs/mergePacks.js';
import { validateMerged } from '../validation/validateMerged.js';

export { mergePacks, validateMerged };

export async function processAndValidateConfig(userMsdConfig) {
  const mergedConfig = await mergePacks(userMsdConfig);
  const provenance = mergedConfig.__provenance;

  // Store original user config in debug namespace
  if (typeof window !== 'undefined') {
    window.__msdDebug = window.__msdDebug || {};
    window.__msdDebug._originalUserConfig = userMsdConfig;
  }

  // Validation pass
  const t0 = performance.now();
  const issues = validateMerged(mergedConfig);
  mergedConfig.__issues = issues;
  const t1 = performance.now();
  try { window.__msdDebug && (window.__msdDebug._validationMs = (t1 - t0)); } catch {}

  // Anchor validation - UPDATED to accept overlay IDs as virtual anchors
  try {
    const existingCodes = new Set(issues.errors.map(e=>e.code));
    const anchorSet = new Set(Object.keys(mergedConfig.anchors || {}));

    // Add overlay IDs as valid anchor targets (same as in validateMerged)
    const overlayIds = new Set();
    (mergedConfig.overlays || []).forEach(overlay => {
      if (overlay && overlay.id) {
        overlayIds.add(overlay.id);
        anchorSet.add(overlay.id); // Make overlay IDs valid anchor targets
      }
    });

    (mergedConfig.overlays || []).forEach(o=>{
      if (!o || !o.id) return;
      const aRefs = [];
      if (typeof o.anchor === 'string') aRefs.push(o.anchor);
      if (typeof o.attach_to === 'string') aRefs.push(o.attach_to);
      if (typeof o.attachTo === 'string') aRefs.push(o.attachTo);
      aRefs.forEach(ref=>{
        if (ref && !anchorSet.has(ref)) {
          const code = 'anchor.missing';
          if (!existingCodes.has(`${code}:${ref}:${o.id}`)) {
            issues.errors.push({ code, severity:'error', overlay:o.id, anchor:ref, msg:`Overlay ${o.id} references missing anchor '${ref}'` });
            existingCodes.add(`${code}:${ref}:${o.id}`);
          }
        }
      });
    });
  } catch(_) {}

  return { mergedConfig, issues, provenance };
}

export async function processMsdConfig(userMsdConfig) {
  try {
    const preValidation = validateMerged(userMsdConfig);
    const mergedConfig = await mergePacks(userMsdConfig);
    const postValidation = validateMerged(mergedConfig);

    const issues = {
      errors: [...preValidation.errors, ...postValidation.errors],
      warnings: [...preValidation.warnings, ...postValidation.warnings]
    };

    if (issues.errors.length > 0) {
      console.error('MSD validation errors:', issues.errors);
    }

    if (issues.warnings.length > 0) {
      console.warn('MSD validation warnings:', issues.warnings);
    }

    return {
      config: mergedConfig,
      validation: issues
    };

  } catch (error) {
    console.error('MSD processing failed:', error);
    throw error;
  }
}
