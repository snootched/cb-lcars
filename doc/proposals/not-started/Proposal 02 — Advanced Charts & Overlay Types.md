# Proposal 02 — Advanced Charts & Overlay Types (Sankey, Topology, Heatmap, Radar/Scanner, Timeline, State Machines, Vector Fields, Waveforms, and Inter-Overlay Integration)

Version: 1.0.0  
Date: 2025-10-20  
Author: CB-LCARS MSD Team (drafted by @snootched via Copilot Space)

Status: Proposed — Not Started

---

Table of contents
- Executive summary
- Goals and non-goals
- Alignment with existing MSD architecture (how it plugs in)
- Overlay types (detailed)
  - Sankey / Flow diagrams
  - Network topology (force-directed)
  - Gradient heatmap (interpolated canvas overlay)
  - Radar / scanner (animated sweep)
  - Timeline / Gantt (ApexCharts `rangeBar` usage + enhancements)
  - State machine diagrams
  - Vector field overlay
  - Waveform / oscilloscope overlay
  - Other supportive overlays (annotations, annotations manager)
- Charting strategy: ApexCharts vs D3 (recommendation)
- Data / pipeline considerations (transforms, aggregations, history/statistics)
- RulesEngine and inter-overlay communication (design)
- Overlay API design (render lifecycle, data contracts, subscription)
- Packs & templates: reusable overlay presets
- UX, accessibility & performance considerations
- Implementation roadmap (phases, milestones, rough estimates)
- Tests & validation plan
- Docs & examples to produce
- Acceptance criteria
- Risks & mitigations
- Files to add / change (PR contents)
- Next steps

---

Executive summary

This proposal describes a practical, phased plan to add a set of advanced overlay types and charting capabilities to the MSD: sankey/flow diagrams, network/topology graphs, gradient heatmaps, radar/scanner effects, timeline/Gantt features, state machine visualization, vector fields, and waveform/oscilloscope overlays. It also defines how inter-overlay communications and RulesEngine integration should work, how overlays should consume MSD data (DataSourceManager, transforms, aggregations), and recommends a hybrid charting strategy: keep ApexCharts as the primary charting library for standard charts and add D3 (and D3 modules like d3-sankey / d3-force) for advanced custom visualizations.

This approach preserves MSD's streaming-first architecture (live WebSocket updates + RollingBuffer + Transform/Aggregation pipeline), reuses the work done (ApexChartsAdapter, DataSourceManager, RollingBuffer, TransformationProcessor, AggregationProcessor) and introduces specialized adapters and overlay renderers for D3 visualizations where needed.

---

Goals and non-goals

Goals
- Provide high-value, LCARS-appropriate visualizations that are not well-served by ApexCharts alone (Sankey, network graphs, scanner).
- Keep ApexCharts for timeseries, bar, pie, radar (when appropriate), heatmap (cell/grid).
- Offer an overlay API that integrates with DataSourceManager, RulesEngine, and transformation/aggregation pipeline.
- Provide Packs / templates for common LCARS usage (energy flow, power distribution, network topology).
- Ensure performance and graceful degradation on lower-powered devices (canvas where appropriate, progressive loading, cache + statistics as in Proposal 01).
- Make overlays configurable via YAML and reusable via Packs.
- Use Anime.js v4 for animations and integrate with window.cblcars.anim for reusable animation patterns.

Non-goals (for this phase)
- Replacing ApexCharts entirely.
- Building a full WYSIWYG editor.
- Extremely high-frequency waveform capture (unless upstream device provides high-rate feed).
- Very large-scale graph analytics (beyond UI visualization needs).

---

Alignment with existing MSD architecture

This proposal reuses and extends existing MSD modules:

- DataSourceManager / MsdDataSource: supply all overlays with live streaming data, transformed and aggregated values. Use the statistics + cache features from Proposal 01 for large-range queries.
- RollingBuffer: in-memory history for live overlays (sparklines, charts).
- TransformationProcessor & AggregationProcessor: support chaining transforms; overlays may reference transformed paths (e.g., `sensor.foo.transformations.celsius`).
- ApexChartsAdapter & ApexChartsOverlayRenderer: keep as primary renderer for standard charts. Extend the adapter to accept new overlay-level options and annotation hooks.
- RulesEngine: used for conditional logic, overlay patches, and inter-overlay control (tags/bulk selectors from Appendix C).
- SvgElementController and LayerManager (Appendix D/E): for reactive SVG base layer and layered rendering.

Overlays must be implemented as *first-class components* inside `src/msd/overlays/` with a standard lifecycle contract (init, render, update, destroy). Each overlay will have an adapter that maps MSD data model to the renderer (ApexCharts or D3/canvas).

---

Overlay types — description, data model, renderer recommendations

For each overlay type I include: purpose, data contract, renderer option and implementation notes.

1) Sankey / Flow diagrams (Priority: High)
- Purpose: Visualize flows (energy, power, data) between nodes with width mapped to magnitude.
- Data contract:
  - nodes: [{ id, label, source (entity), meta }]
  - links: [{ from_node_id, to_node_id, value_source (entity or computed path), meta }]
- Renderer: d3-sankey (preferred). Build a SankeyAdapter (like ApexChartsAdapter) to convert MSD datasource values into d3-sankey nodes/links and compute widths.
- Features: animated flow (dashed/animated stroke), LCARS node styling (rounded rects), hover tooltips, dynamic updates (recompute sankey as values change).
- YAML example:
```yaml
overlays:
  - id: energy_flow
    type: sankey
    position: [60, 120]
    size: [700, 320]
    nodes:
      - id: solar; label: "Solar"; entity: sensor.solar_power
      - id: battery; label: "Battery"; entity: sensor.battery_power
      - id: home; label: "Home"; entity: sensor.home_power
    flows:
      - from: solar; to: home; value: sensor.solar_to_home
      - from: solar; to: battery; value: sensor.solar_to_battery
      - from: grid; to: home; value: sensor.grid_to_home
    style:
      node_color: colors.accent.primary
      link_gradient: true
      animate: true
```
- Integration notes: convert aggregator outputs (aggregations.moving_average) when measuring flows over periods.

2) Network topology (force-directed) (Priority: Medium-High)
- Purpose: Show device connectivity and status (hub, cameras, sensors).
- Data contract:
  - nodes: [{ id, label, entity: optional }]
  - links: [{ source, target, entity: optional for link/state }]
- Renderer: d3-force. Provide options for layout algorithm (forceAtlas-like parameters), pinning nodes to overlays positions, and interactive features (drag nodes, highlight neighbors).
- Implementation notes: overlay should accept anchor points for fixed nodes (e.g., anchored overlays from overlay list). Use DataSourceManager to color nodes by entity state.
- YAML snippet:
```yaml
overlays:
  - id: network_graph
    type: topology
    nodes:
      - id: hub; entity: binary_sensor.hub_online; position: [400,300]
      - id: cam1; entity: camera.front; position: [300,200]
    edges:
      - from: hub; to: cam1; entity: binary_sensor.link_cam1
    style:
      layout: force
      interactive: true
```

3) Gradient heatmap (interpolated / canvas) (Priority: Medium-High)
- Purpose: Spatial field visualization (temperature, WiFi RSSI, signal strength).
- Data contract: list of sample points with positions and scalar value; overlay interpolates across area.
- Renderer: canvas + optional SVG overlay. Perform interpolation (IDW or gaussian kernel) in JS; render to canvas then embed as image into SVG or as absolutely positioned canvas on layers.
- Features: color scale token-driven, adjustable radius/blur, optional contour lines.
- YAML snippet:
```yaml
overlays:
  - id: room_heat
    type: heatmap_gradient
    position: [50, 80]
    size: [600, 400]
    points:
      - position: [110, 120]; entity: sensor.temp_living
      - position: [410, 300]; entity: sensor.temp_kitchen
    style:
      color_scale: ["#0040ff", "#00ff00", "#ffff00", "#ff0000"]
      radius: 80
```

4) Radar / scanner (animated sweep) (Priority: Medium)
- Purpose: Animated sensor sweep with blips; “TNG scanner” effect.
- Data contract: targets (entity providing distance/bearing) OR nodes to plot in polar coordinates.
- Renderer: SVG for rings + Anime.js v4 timeline for sweep animation. Use `window.cblcars.anim` to manage the sweep timeline, rotating a sweep line or stroke-dash animated gradient.
- Features: range rings, sweep animation, fading blips, magnification on hover.
- YAML snippet:
```yaml
overlays:
  - id: tactical_scanner
    type: radar_scanner
    position: [300, 200]
    size: [360, 360]
    targets:
      - entity: person.john
      - entity: device_tracker.phone
    style:
      sweep_speed: 4000
      sweep_color: colors.accent.primary
```

5) Timeline / Gantt (Priority: Low-Medium)
- Purpose: Visualization of state durations/activities with time ranges.
- Chart option: ApexCharts `rangeBar` already supports this. For advanced Gantt features (drag/resize tasks), consider a lightweight custom overlay that overlays interactive controls (foreignObject) tied to HA services.
- Implementation: extend ApexChartsAdapter to support improved labeling, stacking and custom tooltips for events aligned to HA statistics timestamps.

6) State machine diagrams (Priority: Low)
- Purpose: Visualize finite-state machines and transitions (alarm systems, process flows).
- Renderer: dagre-d3 or d3-dag for auto-layout. Nodes represent states; transitions as edges; use RulesEngine to highlight current state.
- Data contract: states and transitions, current state mapping to HA entity.
- YAML snippet:
```yaml
overlays:
  - id: alarm_machine
    type: state_machine
    states:
      - id: disarmed; label: DISARMED
      - id: armed_home; label: ARMED HOME
      - id: triggered; label: TRIGGERED
    transitions:
      - from: disarmed; to: armed_home; label: arm
      - from: armed_home; to: triggered; label: sensor_trigger
    current_state_entity: alarm_control_panel.home
```

7) Vector field overlay (Priority: Low)
- Purpose: Show direction + magnitude (airflow, wind, force).
- Renderer: SVG or canvas arrows plotted on a grid. Use color/size to indicate magnitude.
- Implementation notes: static-ish overlay updated at moderate rate. Use canvas for high-density grids to preserve performance.

8) Waveform / oscilloscope overlay (Priority: Very Low)
- Purpose: High-frequency timeseries (audio/vibration).
- Reality check: HA entity updates typically not at sufficient frequency. Only implement if high-rate source available (MQTT/ESPHome streaming).
- Renderer: canvas, circular buffer. Provide sample-rate / buffer configuration.
- YAML example:
```yaml
overlays:
  - id: mic_wave
    type: waveform
    source: sensor.mic_rms_fast
    buffer_size: 1024
    style:
      color: colors.accent.primary
```

9) Support overlays: annotations manager, dynamic legends, brush/zoom helpers, export snapshot
- Provide shared services for overlays to request annotations, highlight regions, snapshot images, and for centralized legend control.

---

Charting strategy: ApexCharts vs D3

Short answer / recommendation (hybrid):
- Keep ApexCharts as your primary charting engine for standard charts (line, area, bar, pie, donut, radar, heatmap cell, candlestick, boxPlot, scatter). You already have an extensive ApexChartsAdapter with MSD-specific integrations (token resolution, style mapping, smoothing, aggregation hooks). ApexCharts provides:
  - Quick setup, consistent API
  - Built-in animations that are polished and performant
  - Good support for timeseries features (tooltips, zoom, brush/selection)
  - Lighter integration effort for typical dashboards
- Use D3 (and D3 submodules) for *specialized* visualizations where ApexCharts does not offer native support:
  - Sankey (d3-sankey), force-directed/topology (d3-force), custom layout graphs, contour/gradient heatmaps when you need full control, or custom animated scanner effects if you prefer D3 for complex geometry. D3 is the canonical toolkit for highly customized visualizations; it is low-level and provides the flexibility needed for LCARS custom effects.
- Avoid replacing ApexCharts with D3 entirely: D3 requires substantially more implementation effort and developer time for standard charts and lacks the convenience features (legends, axis formatters, responsive behaviors) ApexCharts provides out-of-the-box.

Why hybrid is best:
- Developer productivity and maintainability: ApexCharts handles the majority of time-series needs with less code.
- Flexibility and uniqueness: D3 gives you the power when ApexCharts can't represent the visualization (Sankey, topology).
- Size/weight tradeoff: D3 utilities for only the features you need keeps bundle size reasonable (import submodules rather than whole D3 where possible).
- You already have ApexChartsAdapter and an overlay renderer pipeline — build D3 overlay adapters that follow the same lifecycle and data contract.

Implementation notes for the hybrid approach:
- Provide `d3` only for overlays that need it; use dynamic `import()` to lazy-load d3 modules so they are only fetched when the overlay is used (reduces initial bundle footprint).
- Build an adapter interface (SankeyAdapter, TopologyAdapter, HeatmapAdapter) under `src/msd/overlays/` that handles data mapping, rendering, refreshing, and cleanup. Each adapter should accept a common options structure (size, position, style, dataSources).
- Ensure D3 renderers respect Shadow DOM: render into the mount element passed by pipeline, avoid document-level queries. Use `mountEl` provided by pipeline.

---

Data / pipeline considerations

- Overlays must prefer DataSourceManager as the single source of truth (use `getEntity()` for entity-like access or reference `datasource.transformations.xxx` dot notation).
- For historical/trend visualizations, prefer the Statistics + cache path from Proposal 01 for long-range data.
- For high-frequency live overlays use RollingBuffer and `subscribe` / `subscribeWithMetadata` from DataSourceManager.
- All overlays must filter and validate incoming data points (timestamps, finite numeric values) before rendering — reuse the validation logic in ApexChartsAdapter and RollingBuffer.
- Transform & aggregation chaining:
  - Sankey and topology overlays may want aggregated flows (e.g., hourly average flow). They should support referencing `datasource.aggregations.some_agg` or `datasource.transformations.some_transform` paths.
- Synchronization for charts:
  - When multiple overlays share a time range (e.g., master view + brush), provide a small time sync service in pipeline (already present in ApexChartsOverlayRenderer). D3 overlays should accept an external time window for alignment.

---

RulesEngine and inter-overlay communication

Design principle: RulesEngine remains the canonical conditional logic and inter-overlay control layer.

- Do not add separate overlay-level conditional subsystems; instead:
  - Allow overlays to emit named events (e.g., `overlay:click`, `overlay:dragged`, `overlay:highlight-request`) into the RulesEngine event bus.
  - RulesEngine can then respond by applying overlay patches (using selectors, tags, `all:`), trigger view switches (Appendix E), modify SVG elements (SvgElementController), or call services.
- Support subscription-style inter-overlay linkages through RulesEngine-generated patches:
  - Example: a slider overlay updates `input_number.target_temp`; RulesEngine rule triggers an overlay patch to add an annotation to the chart.
- Add "overlay conditions" to RulesEngine to directly inspect overlay internal state (e.g., lastClickedPoint, selection region) — implemented as an extension to `getEntity()` semantics in DataSourceManager or as overlay metadata available to rules.
- Implement an event registration API: overlays register their event schema during init with SystemsManager; RulesEngine can then be configured to react to overlay events.

---

Overlay API design (lifecycle & data contracts)

All overlays must implement a standard lifecycle and API:

- class OverlayBase
  - constructor(overlayConfig, systemsManager)
  - async initialize(mountEl) — called once with mount element inside the MSD shadow root
  - async render() — initial render using current data
  - update(updateMetadata) — called on data update or rule patch
  - getDimensions() — used by overlay managers for positioning
  - destroy() — cleanup subscriptions, timers, event listeners
  - subscribeToData(sourceRef, callback) — helper to call DataSourceManager.subscribeOverlay
- Data contract between overlay and DataSourceManager:
  - Overlays specify sources as `source: "mySensor"` or dot-path `source: "mySensor.transformations.celsius"` or `aggregations` path.
  - SystemsManager / DataSourceManager will provide immediate snapshot and then stream updates.
- All rendering code must use the provided mount element; do not query `document`.

---

Packs & templates

- Provide a set of starter Packs (e.g., `energy-pack`, `network-pack`, `tactical-pack`) including overlay templates for Sankey energy flow, topology network map, radar-scanner, and heatmap presets.
- Expose templates via Pack system already planned in MSD packaging.
- Encourage community to publish Packs for uncommon overlays.

---

UX, accessibility & performance considerations

- Performance:
  - Lazy-load heavy libraries (d3-sankey, d3-force) with dynamic import.
  - Use canvas for heavy pixel operations (heatmap, waveform).
  - Throttle/debounce frequent updates; coalesce updates with DataSourceManager's subscribe options.
- Accessibility:
  - Expose textual summaries and alt text for complex overlays (e.g., Sankey legend and summary with totals).
  - Tooltips should be accessible and keyboard-focusable when possible (but keep in mind shadow DOM constraints).
- Mobile:
  - Provide adaptive rendering: fewer nodes, lower animation frame rates, simplified effects.
- Visual consistency:
  - Use theme token resolver (`themeTokenResolver`) for colors, stroke widths, typography.
  - Provide LCARS-styled defaults in each overlay, allow Pack or user override.

---

Implementation roadmap (phased)

Phase 0 — Prep (1 week)
- Define overlay base class and lifecycle in `src/msd/overlays/OverlayBase.js`.
- Define adapter interface for ApexCharts (existing) and D3 overlays.
- Add dynamic import helpers in `window.cblcars.anim` and `window.cblcars.lazy` utilities.

Phase 1 — High-value overlays (4–6 weeks)
- Sankey overlay (d3-sankey) — adapter + renderer + YAML schema + pack template.
- Topology overlay (d3-force) — basic interactive layout + anchor support.
- Gradient heatmap (canvas) — IDW interpolation implementation + style tokens.
- Integration tests and example pack (energy-pack + network-pack).

Phase 2 — Animated overlays & polish (3–4 weeks)
- Radar / scanner overlay (animated sweep via Anime.js v4).
- ApexCharts timeline / `rangeBar` improvements (labels, brush sync).
- Annotations manager (shared service for overlays to add threshold lines).

Phase 3 — Auxiliary & niche overlays (3–4 weeks)
- State machine overlay (dagre-d3)
- Vector field overlay
- Waveform overlay (conditional on high-frequency data source availability)

Phase 4 — UX, docs, packs, QA (2–3 weeks)
- Add packs, example configurations, developer guides.
- Update `cblcars.dev` debugging helpers (list D3 overlays, caches).
- Performance optimization and testing on lower-end devices.
- Release v1 of Advanced Overlays.

Rough total estimate: 10–16 weeks across multiple engineers (parallelizable: Sankey + Topology + Heatmap can be done concurrently).

---

Tests & validation plan

- Unit tests:
  - Overlay base class lifecycle and error handling
  - Adapters mapping tests (convert datasource points -> d3/sankey link widths)
  - Canvas interpolation correctness (heatmap)
- Integration tests:
  - Live updates through DataSourceManager feed into overlays
  - RulesEngine triggered overlay patches (bulk selectors & tags)
  - Verify shadowRoot rendering behavior (no document queries)
- Manual QA:
  - Desktop & mobile performance profiling (Chrome devtools)
  - Visual regression for LCARS themes and tokens
- Automated visual tests (optional):
  - Screenshot diffs for key overlays under known datasets

---

Docs & examples to produce

- `doc/user-guide/overlays.md` — new section describing each overlay, YAML schema, examples
- `doc/examples/energy-pack.yaml` — Sankey + heatmap + related overlays
- `doc/examples/network-pack.yaml` — Topology + node detail overlays
- `doc/developer/overlay-api.md` — overlay developer guide with lifecycle & adapter examples
- `doc/architecture/overlay-rendering.md` — rendering pipeline and Shadow DOM considerations
- Update existing `ApexChartsAdapter.js` docs with brush/time-sync APIs

---

Acceptance criteria

- New overlay base class and adapter contracts documented and merged.
- Sankey overlay implemented and usable via YAML with an example Pack.
- Topology overlay implemented and usable with anchor support.
- Gradient heatmap implemented with canvas; supports token-driven color scales.
- D3 modules are lazily loaded and not pulled in unless overlay used.
- All overlays operate inside the mount element (no document queries) and respect shadow DOM.
- RulesEngine can patch overlays using selectors/tags (Appendix C) and overlays can emit events that RulesEngine consumes.
- Performance targets: initial render for a typical MSD (20 overlays) under 500ms on modern desktop; sensible behavior on low-powered devices (mobile) with simplified visuals.
- Documentation and example Packs published in `/doc`.

---

Risks & mitigations

- Risk: D3 complexity increases development time.
  - Mitigation: limit D3 usage to specialized overlays; implement minimal viable feature set first.
- Risk: Bundle size grows.
  - Mitigation: dynamic import d3 submodules; only include when overlay present.
- Risk: Shadow DOM / Anime.js integration mistakes.
  - Mitigation: strictly use mountEl provided by pipeline; use Anime.js v4 Scopes API and ensure `window.cblcars.anim` helpers exist.
- Risk: Overlapping responsibilities with ApexCharts (duplication).
  - Mitigation: clearly document which overlay types use which library; share styling tokens and legend components.
- Risk: High CPU usage for canvas heatmaps or dense topology graphs.
  - Mitigation: simplify on mobile, downsample points, use devicePixelRatio appropriately, use WebWorker for heavy interpolation if necessary.

---

Files to add / change (proposed PR contents)

- New overlay base:
  - `src/msd/overlays/OverlayBase.js` (lifecycle & helpers)
- Sankey:
  - `src/msd/overlays/SankeyOverlay.js` (D3-based)
  - `src/msd/overlays/adapters/SankeyAdapter.js`
- Topology:
  - `src/msd/overlays/TopologyOverlay.js`
- Heatmap:
  - `src/msd/overlays/HeatmapGradientOverlay.js` (canvas)
- Radar:
  - `src/msd/overlays/RadarScannerOverlay.js`
- State machines:
  - `src/msd/overlays/StateMachineOverlay.js` (dagre-d3 adapter)
- Vector field & Waveform (optional stubs):
  - `src/msd/overlays/VectorFieldOverlay.js`
  - `src/msd/overlays/WaveformOverlay.js`
- Utility & support:
  - `src/msd/overlays/AdapterInterface.md` (developer doc)
  - `src/msd/overlays/d3-loader.js` (dynamic import helpers)
- Docs and examples:
  - `doc/user-guide/overlays.md` (new)
  - `doc/examples/energy-pack.yaml` (new)
  - `doc/examples/network-pack.yaml` (new)

---

Next steps

1. Approve this proposal and the hybrid charting strategy (ApexCharts + D3 modules).
2. I will scaffold `OverlayBase.js` and `SankeyOverlay.js` using d3-sankey with lazy imports and a SankeyAdapter that consumes DataSourceManager. (I can produce patch code for these files.)
3. Iterate on Topology and Heatmap overlays, deliver example Packs and docs.
4. After Phase 1, measure performance and tune (throttle rates, canvas optimizations).
5. Continue with subsequent phases.

---

If you want I can immediately:
- scaffold `OverlayBase.js` and `SankeyOverlay.js` with D3 lazy-loading, AA-level JSDoc and an example YAML overlay; or
- produce a narrower PR plan broken down into GitHub issues for each overlay (recommended if you want to triage work).

Which do you want me to do next?
