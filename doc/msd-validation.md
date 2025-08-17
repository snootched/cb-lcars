# LCARS MSD Validation & Warnings

This document lists the validations performed on MSD overlays and where to see warnings/errors.

What it does
- Checks overlay array for duplicate ids (must be unique). Duplicate ids are reported as errors.
- Validates required keys per overlay type (errors).
- Flags basic value issues (warnings) for early feedback.
- Surfaces validation messages via:
  - svgOverlayManager (errors are drawn inside the overlays SVG)
  - cblcarsLog (warnings go to the console and respect the global log level)

Where to see messages
- Errors: collected by svgOverlayManager and rendered in the overlays SVG (red text).
- Warnings: printed to the console via cblcarsLog.warn, filtered by your global log level (set with window.cblcars.setGlobalLogLevel).

Rules (initial set)
- Unique ids
  - Error if the same id appears on more than one overlay.

- text
  - Warning if position is missing.

- line
  - Error unless one of the following is provided:
    - points (>= 2), or
    - steps (> 0), or
    - both anchor and attach_to
  - Warning for unsupported attach_side (allowed: auto, left, right, top, bottom).
  - Warning for unsupported attach_align (allowed now: center, start, end; also accepts percent:<0–1> and toward-anchor for future support; invalid percent values warn).

- sparkline
  - Error if position or size is missing.
  - Error if source is missing.

- ribbon
  - Error if position or size is missing.
  - Error if neither source nor sources is provided.

- control
  - Error if id is missing.
  - Error if position or size is missing.
  - Error if card is missing or card.type is not defined.

- free
  - Warning if targets is missing.

Notes
- Validation does not stop rendering. It reports issues so you can fix the config while seeing as much as possible.
- Some overlays can render without an explicit id (text/line/sparkline/ribbon/free) because the renderer can autogenerate an internal id. That’s why missing id for those types is a warning, not an error. Control overlays require id for HTML host placement, so it’s an error there.

Roadmap
- Expand validation to detect conflicting keys (e.g., points + steps + route:auto).
- Late‑pass checks: unresolved smart connectors, empty sparkline data windows with misconfig, etc.
- Optional badge in the debug layer summarizing the count of errors/warnings.

— End of Validation —


# MSD Overlay Validation & Debug Escalation

## Overview
Validation catches misconfigurations early and surfaces them in both the console and an in-SVG HUD layer. Errors always display; warnings are optionally escalated.

## Debug Flag
Set:
```yaml
variables:
  msd:
    debug:
      validation: true
```
When true:
- Warnings are promoted to the overlay HUD (yellow).
- Unresolved connector warnings after layout appear on the HUD.

## Current Rule Set
Errors:
- Missing overlay.type
- Control missing id
- Control / sparkline / ribbon missing required position/size/source
- Line missing points/steps and missing both anchor + attach_to
- Duplicate ids

Warnings:
- Non-control overlay missing id
- Unsupported attach_side
- Unsupported or malformed attach_align (percent out of range, etc.)
- Free overlay missing targets
- Other unknown overlay types

## Escalation Behavior
- Without debug.validation: warnings logged (console); only errors in HUD (red).
- With debug.validation: warnings (yellow) + errors (red) appear in HUD.

## Unresolved Connectors
After each connector layout pass, any path with:
- data-cblcars-attach-to present
- And either:
  - d attribute empty or trivial (e.g. M0,0 L0,0)
  - data-cblcars-geom-pending="true"
is considered unresolved.

Message format (warning):
[connectors] N unresolved: line_a->target_x, line_b->target_y

## How to Fix Unresolved Connectors
1. Verify target id exists & has non-zero bbox.
2. Ensure anchors / position produce valid geometry before first layout (may need deferred invalidate).
3. If geometry is genuinely dynamic, allow first auto-retry, or manually call:
   window.cblcars.connectors.invalidate(lineId);
   window.cblcars.overlayHelpers.layoutPendingConnectors(root, viewBox);

## HUD Rendering
- Yellow text: warnings
- Red text: errors
- Order: warnings first, then errors

## Programmatic Access
Per-overlay validation details stored at:
  shadowRoot.__cblcars_validationById[id] = { errors:[], warnings:[] }

Counts:
  shadowRoot.__cblcars_validationCounts = { errors:<n>, warnings:<n> }

## Future Enhancements
- Per-rule suppressions
- Severity categories (info / hint)
- Integration with authoring UI (inline field highlighting)
