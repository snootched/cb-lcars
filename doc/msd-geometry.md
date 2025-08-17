# MSD Geometry & CTM Utilities

This document describes the centralized geometry system used by the CB‑LCARS MSD layer.

## Goals
- Single source of truth for SVG viewBox to screen (CSS pixel) transforms.
- Consistent placement of HTML “control” overlays above the SVG overlay layer.
- Debuggable, self‑verifying round‑trip math to catch regressions early.

## Key API (window.cblcars.geometry)
- getReferenceSvg(root): Find the authoritative SVG.
- getViewBox(root): Return [minX, minY, width, height].
- viewBoxPointToScreen(svg, x, y) / screenPointToViewBox(svg, sx, sy)
- viewBoxRectToScreen / screenRectToViewBox
- mapViewBoxRectToHostCss(root, rect[, hostRect])
- pxGapToViewBox(root, pixels)
- selfTest(root[, { pxThreshold, samples, log } ])
- runAutoSelfTest(root) (internal: used when debug.geometry flag is active)

## Debug Flag
Set variables.msd.debug.geometry: true in the MSD card YAML to:
- Enable auto self-test (once per card root).
- Allow debug layer (if other debug flags also active) to include geometry overlays.

## Self-Test
The self-test:
1. Collects a set of sample viewBox points (corners, center, quarters).
2. Maps to screen via CTM.
3. Maps back via inverse CTM.
4. Computes pixel delta between original and round-tripped points.
5. Logs a summary:
   [geometry.selfTest] maxΔ=0.312px (threshold 0.75px) ok=true

Threshold (default 0.75px) is conservative; large discrepancies usually indicate:
- Stale CTM cache (SVG replaced without invalidation).
- Nested transforms applied between measurement and layout.
- Rapid reflow before first layout stabilized.

## When It Runs
- Automatically (double rAF) after first overlay render if debug.geometry flag is true.
- Manually: window.cblcars.geometry.selfTest(card.shadowRoot, { pxThreshold: 0.5 })

## Common Issues & Remedies
| Symptom | Cause | Fix |
| ------- | ----- | --- |
| maxΔ > threshold after resize | Layout ran before SVG stabilized | Allow one additional rAF or trigger controls.relayout |
| Infinity/NaN deltas | No reference SVG found | Check base_svg loaded correctly |
| Some controls misaligned while self-test OK | Controls size/position fallback | Confirm mapViewBoxRectToHostCss returned non-null; inspect debug layer |

## controls.relayout
If you dynamically alter overlays/anchors, call:
  window.cblcars.controls.relayout(msdCardInstance);
This replays the last stored control layout arguments.

## Future Enhancements
- Expanded sample grid density when discrepancies found.
- Visual overlay highlighting deltas > threshold.
- Automatic downgrade to ratio fallback if CTM unavailable.
