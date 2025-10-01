import { perfTime } from '../perf/PerfCounters.js';

export async function buildCardModel(mergedConfig) {
  return perfTime('cardModel.build', async () => {
    // Phase A: implement viewBox:auto + SVG anchor extraction + percent resolution.
    // Extract actual viewBox from SVG content instead of hardcoding
    let viewBox = [0, 0, 400, 200]; // fallback only

    console.debug('[CardModel] Initial viewBox (fallback):', viewBox);
    console.debug('[CardModel] Merged config base_svg:', mergedConfig.base_svg);

    // Handle base_svg in multiple formats:
    // Format 1: base_svg: "builtin:template-name"
    // Format 2: base_svg: { source: "builtin:template-name" }
    let baseSvgSource = null;
    if (typeof mergedConfig.base_svg === 'string') {
      baseSvgSource = mergedConfig.base_svg;
    } else if (mergedConfig.base_svg && typeof mergedConfig.base_svg === 'object' && mergedConfig.base_svg.source) {
      baseSvgSource = mergedConfig.base_svg.source;
    }

    console.debug('[CardModel] Resolved base_svg source:', baseSvgSource);

    // Try to extract actual SVG viewBox from base_svg
    if (baseSvgSource) {
      console.log('[CardModel] Using SVG source:', baseSvgSource);
      const { getSvgContent, getSvgViewBox } = await import('../../utils/cb-lcars-anchor-helpers.js');
      const svgContent = getSvgContent(baseSvgSource);
      if (svgContent) {
        const extractedViewBox = getSvgViewBox(svgContent);
        if (extractedViewBox && Array.isArray(extractedViewBox) && extractedViewBox.length === 4) {
          viewBox = extractedViewBox;
          console.log('[CardModel] Extracted viewBox from SVG:', viewBox);
        } else {
          console.warn('[CardModel] Could not extract viewBox from SVG content');
        }
      } else {
        console.warn('[CardModel] Could not get SVG content for:', baseSvgSource);
      }
    } else {
      console.warn('[CardModel] No base_svg specified in merged config');
    }

    console.log('[CardModel] Final viewBox:', viewBox);

    const anchors = {}; // merged + normalized numeric
    const overlaysBase = mergedConfig.overlays.map(o => ({ id: o.id, type: o.type, style: o.style || {}, raw: o }));

    return { viewBox, anchors, overlaysBase, __raw: mergedConfig };
  });
}