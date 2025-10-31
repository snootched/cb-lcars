import { perfTime } from '../perf/PerfCounters.js';
import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

export async function buildCardModel(mergedConfig) {
  return perfTime('cardModel.build', async () => {
    // Phase A: implement viewBox:auto + SVG anchor extraction + percent resolution.
    // Extract actual viewBox from SVG content instead of hardcoding
    let viewBox = [0, 0, 400, 200]; // fallback only

    cblcarsLog.trace('[CardModel] Initial viewBox (fallback):', viewBox);
    cblcarsLog.trace('[CardModel] Merged config base_svg:', mergedConfig.base_svg);

    // Handle base_svg in multiple formats:
    // Format 1: base_svg: "builtin:template-name"
    // Format 2: base_svg: { source: "builtin:template-name" }
    let baseSvgSource = null;
    if (typeof mergedConfig.base_svg === 'string') {
      baseSvgSource = mergedConfig.base_svg;
    } else if (mergedConfig.base_svg && typeof mergedConfig.base_svg === 'object' && mergedConfig.base_svg.source) {
      baseSvgSource = mergedConfig.base_svg.source;
    }

    cblcarsLog.trace('[CardModel] Resolved base_svg source:', baseSvgSource);

    // Try to extract actual SVG viewBox from base_svg
    if (baseSvgSource) {
      cblcarsLog.debug('[CardModel] Using SVG source:', baseSvgSource);
      const { getSvgContent, getSvgViewBox } = await import('../../utils/cb-lcars-anchor-helpers.js');
      const svgContent = getSvgContent(baseSvgSource);
      if (svgContent) {
        const extractedViewBox = getSvgViewBox(svgContent);
        if (extractedViewBox && Array.isArray(extractedViewBox) && extractedViewBox.length === 4) {
          viewBox = extractedViewBox;
          cblcarsLog.debug('[CardModel] Extracted viewBox from SVG:', viewBox);
        } else {
          cblcarsLog.warn('[CardModel] Could not extract viewBox from SVG content');
        }
      } else {
        cblcarsLog.warn('[CardModel] Could not get SVG content for:', baseSvgSource);
      }
    } else {
      cblcarsLog.warn('[CardModel] No base_svg specified in merged config');
    }

    cblcarsLog.debug('[CardModel] Final viewBox:', viewBox);

    const anchors = {}; // merged + normalized numeric

    // Preserve template property in overlays
    const overlaysBase = mergedConfig.overlays.map(o => {
      const baseOverlay = {
        id: o.id,
        type: o.type,
        style: o.style || {},
        raw: o
      };

      // Preserve template reference if present
      if (o.template && typeof o.template === 'string') {
        baseOverlay.template = o.template;
      }

      // Preserve animation_preset reference if present (for Phase 3)
      if (o.animation_preset && typeof o.animation_preset === 'string') {
        baseOverlay.animation_preset = o.animation_preset;
      }

      // Preserve other critical properties
      if (o.source) baseOverlay.source = o.source;
      if (o.data_source) baseOverlay.data_source = o.data_source;
      if (o.sources) baseOverlay.sources = o.sources;
      if (o.position) baseOverlay.position = o.position;
      if (o.size) baseOverlay.size = o.size;

      return baseOverlay;
    });

    return { viewBox, anchors, overlaysBase, __raw: mergedConfig };
  });
}
