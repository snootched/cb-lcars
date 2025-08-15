# LCARS MSD Debugging Guide

This document explains how to enable and use the CB‑LCARS debugging tools added to the MSD framework: visual overlays, logging integration, and performance metrics. It also lists the runtime API you can use from the browser console or future editors. We’ll keep this document updated as new debug features ship.

---------------------------------------------------------------------

## What the debugger includes

- Visual debug layer (non-interactive) drawn inside the overlays SVG:
  - Anchors: green dots at all known anchors
  - Overlay element boxes: pale blue rectangles around stamped SVG elements
  - Connector targets and endpoints: magenta rectangles and dashed guidelines for smart attach_to lines
  - Perf HUD: small “Perf” panel summarizing timing metrics
- Console logging integrated with the global CB‑LCARS log level and styled logger
- Unified runtime API under window.cblcars.debug
- Optional global debug flags and per-card flags (merged)

All visuals are off by default. Enabling any debug flag does not affect production behavior and does not intercept pointer events.

---------------------------------------------------------------------

## Enabling debug via YAML (per card)

Add a debug section under variables.msd for your cb-lcars-msd card. Example:

```yaml
type: custom:cb-lcars-msd-card
variables:
  msd:
    base_svg: builtin:ncc-1701-a-blue
    debug:
      level: debug         # optional: sets global log level ('error'|'warn'|'info'|'debug')
      connectors: true     # magenta targets/endpoints for smart connectors
      overlay: true        # anchor dots + overlay element bounding boxes
      geometry: false      # console CTM/viewBox logs
      perf: true           # show Perf HUD (if available)
    overlays:
      # ... your overlays ...
```

Notes:
- level updates the global logger (same as window.cblcars.setGlobalLogLevel('debug')).
- You can set any subset of flags; visuals render only when their flag is true.

---------------------------------------------------------------------

## Global log level (central logger)

All debug console output uses the project’s styled logger and is filtered by the global log level.

- Set in YAML with variables.msd.debug.level: debug
- Or programmatically:
  - window.cblcars.setGlobalLogLevel('debug')
  - or window.cblcars.setGlobalLogLevel.debug()

Valid levels: error, warn, info, debug

---------------------------------------------------------------------

## Runtime API (window.cblcars.debug)

You can toggle or inspect debug features at runtime from the browser console. All functions are no-ops if the underlying modules are not present.

- Set/merge global flags
  - window.cblcars.debug.setFlags({ connectors: true, overlay: true, perf: true })

- Set global log level
  - window.cblcars.debug.setLevel('debug')

- Render the debug layer once
  - window.cblcars.debug.render(root, viewBox, { anchors, flags })
    - root: card.shadowRoot (preferred)
    - viewBox: [minX, minY, width, height] if you have it
    - anchors: map of anchorName -> [x,y] (optional if already stored globally)

- Clear the debug layer
  - window.cblcars.debug.clear(root)

- Log geometry to console (respects global log level)
  - window.cblcars.debug.logGeometry(root)

- Perf metrics
  - window.cblcars.debug.perf.start('label')
  - window.cblcars.debug.perf.end('label')           // records last/avg/max/count
  - window.cblcars.debug.perf.get()                  // all labels
  - window.cblcars.debug.perf.get('connectors:layout')
  - window.cblcars.debug.perf.reset()                // clear all
  - window.cblcars.debug.perf.reset('controls:render')
  - window.cblcars.debug.perf.clearActive()          // cancel in-flight timers

Tips:
- Most cards save anchors globally for convenience: window.cblcars.msdAnchors
- To locate a card’s ShadowRoot quickly in the console, select it in the Elements panel and use $0.shadowRoot.

---------------------------------------------------------------------

## Visual layers (what you’ll see)

- Anchors (overlay flag): green circles for each anchor id found in the base SVG and user overrides. Radius scales with viewBox height.
- Overlay element boxes (overlay flag): pale blue rectangles around stamped SVG elements with ids (text, line, sparkline path, etc.).
- Connectors (connectors flag):
  - Magenta rectangle: the computed target box of attach_to (works for both SVG overlays and HTML control overlays).
  - Dashed magenta line: from the line’s start (anchor/start point) to the computed endpoint on the chosen side of the target box.
  - Magenta dot: the final computed endpoint (respects attach_side and attach_gap; "Npx" gaps are auto-converted to viewBox units using CTM).
- Perf HUD (perf flag): a small panel in the top-left listing timing stats:
  - label: last (ms), avg (ms), max (ms), n=count
  - Example labels currently used:
    - controls:render — total time per controls layout pass
    - connectors:layout — time spent recomputing deferred connectors

Implementation details:
- The debug layer is appended as <g id="cblcars-debug-layer"> inside the overlays SVG and uses pointer-events: none.
- It is re-rendered automatically after overlays are stamped and after control overlays (re)layout, when flags are set.

---------------------------------------------------------------------

## Geometry and CTM notes (for accuracy)

- Target boxes for HTML controls are computed by mapping their client rects to viewBox units using the SVG’s inverse screen CTM.
- This avoids drift and letterboxing issues and keeps attach_gap "Npx" visually consistent at any size.
- On resize, controls re-layout will trigger a connectors re-layout; with debug flags on, the visuals update too.

If visuals don’t align:
- Enable debug.geometry to log viewBox and CTM.
- Ensure both base SVG and controls host align to the same wrapper box.

---------------------------------------------------------------------

## Typical workflows

Quick toggle during layout:
1) In YAML, set:
   variables.msd.debug:
     connectors: true
     overlay: true
     perf: true
     level: debug
2) Reload the dashboard. Move/resize controls or lines in YAML and watch live updates.
3) Inspect the Perf HUD after resizing or toggling controls.

Ad-hoc inspection in console:
- window.cblcars.debug.setFlags({ connectors: true })
- window.cblcars.debug.render($0.shadowRoot, [0,0,1920,1200], { anchors: window.cblcars.msdAnchors })

Reset visuals:
- window.cblcars.debug.clear($0.shadowRoot)
- window.cblcars.debug.perf.reset()

---------------------------------------------------------------------

## Troubleshooting

- No debug visuals appear:
  - Confirm flags: variables.msd.debug.overlay/connectors/perf set to true, or set via debug.setFlags.
  - Confirm you’re rendering into the correct root (card’s shadowRoot).
- Connector endpoint looks offset or on a wrong side:
  - Set attach_gap: 0 to verify endpoint, then increase.
  - Force a side with attach_side: left|right|top|bottom.
- Geometry logs not showing:
  - Ensure global log level is debug or info: window.cblcars.setGlobalLogLevel('debug'); enable debug.geometry.
- Perf HUD empty:
  - Ensure debug.perf: true.
  - The HUD displays stats after at least one measured pass (e.g., a resize or a forced layout).

---------------------------------------------------------------------

## Reference (current flags and measurements)

Flags
- level: 'error' | 'warn' | 'info' | 'debug' (optional; sets global log level)
- overlay: boolean (anchor dots + overlay element boxes)
- connectors: boolean (connector target boxes, dashed guidelines, endpoints)
- geometry: boolean (console logs of viewBox, CTM, wrapper/host rects)
- perf: boolean (shows Perf HUD; also logs via cblcarsLog.debug)

Perf labels (initial set)
- controls:render — total time for a control overlays layout pass
- connectors:layout — time spent re-laying deferred connector paths

These labels may expand over time as we instrument more subsystems.

---------------------------------------------------------------------

## Internals and files (for contributors)

- Debug helpers and API: utils/cb-lcars-debug-helpers.js
- Geometry utilities (CTM, mappings): utils/cb-lcars-geometry-utils.js
- Controls overlay layout: utils/cb-lcars-controls-helpers.js
- Overlay stamping and connector generation: utils/cb-lcars-overlay-helpers.js
- Logging: utils/cb-lcars-logging.js

Where it draws:
- Inside the overlays SVG as <g id="cblcars-debug-layer">.
- Pointer events are disabled to avoid blocking interactions.

---------------------------------------------------------------------

## Roadmap for debugging (will update as shipped)

- Add validation warnings count into the debug layer
- Add obstacle-overlay and router path previews when auto-router lands
- Perf: separate labels for per-subsystem (e.g., sparkline redraw), and min/max histogram over time
- Editor hooks: live toggles + introspection of anchors/overlays

— End of MSD Debugging Guide —