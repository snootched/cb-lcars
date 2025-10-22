# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### BREAKING CHANGES - Phase 0: Dead Code Removal (2025-10-22)

**This is part of a comprehensive architecture refactor. See `doc/proposals/🚀 Refactor - Execution Plan.md` for full details.**

#### Removed Overlay Types

The following overlay types are no longer supported:

- **`sparkline`** - Removed sparkline overlay renderer
- **`historybar`** - Removed historybar overlay renderer
- **`ribbon`** - Removed ribbon overlay support

**Migration Path:**

For sparkline-like visualizations:
```yaml
# OLD (no longer supported)
overlays:
  - type: sparkline
    source: temperature_sensor

# NEW (use apexchart)
overlays:
  - type: apexchart
    source: temperature_sensor
    chart_config:
      chart:
        type: line
        sparkline:
          enabled: true
```

For historybar-like visualizations:
```yaml
# OLD (no longer supported)
overlays:
  - type: historybar
    source: power_usage

# NEW (use apexchart)
overlays:
  - type: apexchart
    source: power_usage
    chart_config:
      chart:
        type: bar
```

#### Removed Internal Methods

The following internal methods have been removed (no public API impact):

- `ModelBuilder._subscribeOverlaysToDataSources()` - Sparkline/ribbon subscription handler
- `ModelBuilder._monitorPendingSubscriptions()` - Sparkline/ribbon subscription monitoring
- `SystemsManager._updateTextOverlaysForDataSourceChanges()` - Deprecated, replaced by `BaseOverlayUpdater`
- `SystemsManager._findDataSourceForEntity()` - Helper for deprecated method above

**Developer Impact:** If you have custom overlays that extended sparkline/historybar, you'll need to migrate to the ApexCharts overlay system or create a custom overlay based on the upcoming `OverlayBase` API (Phase 3).

#### Why These Changes?

This cleanup is Phase 0 of a comprehensive architecture refactor to:
1. Remove unmaintained code paths
2. Prepare for instance-based overlay system (Phase 3)
3. Eliminate competing subscription mechanisms
4. Create a clean foundation for upcoming features

**Next Phases:**
- Phase 1: HASS architecture fix (single source of truth)
- Phase 2: Template processing consolidation
- Phase 3: Overlay Runtime API (instance-based overlays)

---

## [Previous versions]

_No previous releases - project is in active development._
