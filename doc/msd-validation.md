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