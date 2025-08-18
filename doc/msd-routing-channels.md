# MSD Routing – Channel Corridors (Phase B: Rectangles)

Status: Experimental (rectangle corridors only).
Poly-line corridors with radius, bus tapering, glow styling, and advanced spacing heuristics are deferred.

## Goals
Channels provide “preferred corridors” that multiple connectors can share, enabling LCARS bus aesthetics and reducing visual clutter. Inside a channel, path cost is reduced by a weight factor (<1), causing A* to bias toward the corridor when it does not drastically increase distance.

## Configuration

Global (under variables.msd.routing):
```yaml
routing:
  channels:
    - id: main_bus
      rect: [400, 200, 800, 120]  # x, y, width, height (viewBox units)
      weight: 0.6                 # multiplier applied to step cost ( <1 lowers cost )
    - id: aux_bus
      rect: [400, 600, 800, 120]
      weight: 0.7
```

Per line:
```yaml
- type: line
  id: engine_feed
  anchor: source_anchor
  attach_to: target_box
  route: auto
  route_mode_full: grid
  route_channels:
    - main_bus
  route_channel_mode: require   # allow | prefer | require
```

### Modes
- allow (default): Channels act only as optional cost reducers (if route_channels specified, only those count).
- prefer: Same as allow currently; future enhancement may trigger opportunistic re-route if no channel used.
- require: Grid path must traverse at least one preferred channel cell or routing attempt fails (fallback tries larger resolution; final fallback is Manhattan path if all fail).

## Telemetry Attributes
Added to connector <path> elements when grid mode chosen:

| Attribute | Meaning |
|-----------|---------|
| data-cblcars-route-channels | Requested channel ids (comma) |
| data-cblcars-route-channel-mode | allow|prefer|require |
| data-cblcars-route-channels-hit | Channels actually traversed |
| data-cblcars-route-cost-distance | Manhattan distance component |
| data-cblcars-route-cost-bends | Bend penalty component |
| data-cblcars-route-cost-proximity | (Reserved) currently 0 – future proximity accounting |
| data-cblcars-route-cost-channel-factor-avg | (Reserved) average channel multiplier (future) |
| data-cblcars-route-cost-total | Aggregate cost (distance + bends for now) |

Failure reason `no_required_channel` appears in:
```
data-cblcars-route-grid-reason="no_required_channel"
```

## Occupancy
Global occupancy is incremented by number of path cells inside each used channel. Inspect:
```js
window.cblcars.routing.channels.getOccupancy();
```
Use this later to trigger bus styling (thicker stroke, glow) when occupancy surpasses thresholds.



 ## Debugging

 Enable channel overlay rectangles:
 ```yaml
 variables:
   msd:
     debug:
       channels: true     # NEW (or use connectors/overlay flags)
 ```
 When enabled (or when connectors / overlay debug flags are on), the card will render a semi‑transparent layer:
 - Each channel rectangle tinted (stable palette).
 - Hover shows channel id (via <title> tooltip).
 - Layer id: cblcars-channels-debug (recreated each debug refresh).

 If you change channel geometry dynamically (future), call:
 ```js
 window.cblcars.routing.setGlobalConfig({ channels: [...] });
 window.cblcars.routing.channels.ensureChannelDebug(card.shadowRoot);
 ```

## Debug
When any debug flag (connectors/overlay) is active you can manually call:
```js
window.cblcars.routing.channels.debugRenderChannels(card.shadowRoot,
  window.cblcars.routing.channels.parseChannels(card._config.variables.msd.routing.channels));
```
(Automatic debug layer injection is planned.)

## Future Work (Backlog)
- Polyline + radius corridors (complex shapes).
- Spacing penalties & channel capacity heuristics.
- Automatic bus styling (width escalation, glow layering).
- Proximity & channel factor separated in final cost (current A* folds step multipliers directly).
- Grid heatmap overlay showing channel bias vs pure distance.

## Backward Compatibility
All new keys optional. Existing connectors without `route_channels` behave identically.