# MSD Control Overlays – Embedding Lovelace Cards

Control overlays let you place real Lovelace cards on top of your MSD drawing, positioned and sized in the SVG’s coordinate space. This is perfect for buttons, toggles, sliders, etc., that should appear “on the map”.

---------------------------------------------------------------------

## Quick Example

```yaml
- type: control
  id: br_button
  position: [78%, 22%]     # top-left in viewBox coords (percentages OK)
  size: [15%, 10%]         # width x height in viewBox coords (percentages OK)
  z_index: 32              # optional, stack above peers
  card:
    type: button
    entity: light.tv
    name: Bridge
    tap_action:
      action: toggle
```

What happens
- The controls host lives above the SVG overlays but is pointer-events: none so clicks fall through in blank areas.
- Each control box is pointer-events: auto and fully interactive.
- The box’s CSS rectangle is computed by mapping your position/size from the SVG’s viewBox to the on-screen wrapper.

---------------------------------------------------------------------

## Positioning and Sizing

- position accepts an anchor name or an [x, y] pair; values can be numbers or percentage strings (e.g., "78%").
- size accepts [w, h] in the same units as position; numbers or percentages are allowed.
- We convert those to pixel CSS using the wrapper’s current size and the base SVG’s viewBox.

Tips
- Use anchors for ergonomic placement if your SVG ships with meaningful ids.
- Use percentages for responsive layouts that keep proportions across screen sizes.

---------------------------------------------------------------------

## Stacking and Pointer Events

- Host: pointer-events: none; z-index is kept low (e.g., 2) so HA dialogs win by default.
- Control box: pointer-events: auto; z-index defaults to the host’s base but can be overridden per overlay with z_index.
- Do not set huge z-index values—stay within the card’s internal layering so HA modal dialogs remain on top.

---------------------------------------------------------------------

## Supported Cards

Anything you can place in Lovelace (core or custom) can be embedded:
- Core cards: button, entities, gauge, etc.
- Custom cards: use type: custom:<tag> as usual.

We use Home Assistant’s card helpers when available, falling back to direct element creation.

---------------------------------------------------------------------

## Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Card not visible | Wrong position/size or wrapper is 0x0 | Verify your base SVG is rendering and the wrapper has size; check percentage math. |
| Card not interactive | Container pointer-events blocked | In MSD, the host is click-through; ensure you didn’t override it via card-mod. Each control box is pointer-events: auto. |
| Overlapping elements | z_index ordering | Lower z_index for elements that should sit below others; keep numbers modest. |
| Dialogs under the card | Stacking context on wrappers | Avoid transforms/filters on the big wrapper; keep z-indexes low. |

— End of MSD Control Overlays —