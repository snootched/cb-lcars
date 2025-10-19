# 📚 **Phase 5.3 Documentation Updates**

Excellent! Let's update all the relevant documentation to reflect the complete Phase 5 Provenance System.

---

## **Update 1: Overlay Implementation Guide**

**File: `doc/spec/overlay-implementation-guide.md`**

Add a new section after "Critical Implementation Requirements" section. Here's the complete new section to add:

```markdown
## Provenance Tracking (Phase 5)

All overlay renderers should include comprehensive provenance tracking for debugging, performance analysis, and style resolution tracking.

### Overview

The provenance system tracks three key aspects:
1. **Renderer Information** (Phase 5.2A) - Which renderer was used, features utilized
2. **Style Resolution** (Phase 5.2B) - Where style values came from (explicit, theme, fallback)
3. **Performance Metrics** (Phase 5.3) - How long rendering took, stage breakdowns

### Requirements for Renderers Extending BaseRenderer

If your renderer extends `BaseRenderer`, most provenance tracking is automatic:

```javascript
export class MyOverlayRenderer extends BaseRenderer {
  constructor() {
    super();
    this.rendererName = 'MyOverlayRenderer'; // Set for logging
  }

  static render(overlay, anchors, viewBox, svgContainer, cardInstance) {
    const instance = new MyOverlayRenderer();
    instance.container = svgContainer;
    instance.viewBox = viewBox;

    // ✅ Reset tracking for this render
    instance._resetTracking();
    instance._startRenderTiming();

    // Track features as you use them
    if (overlay.gradient) {
      instance._trackFeature('gradient');
    }

    // Your rendering logic here
    const markup = instance.renderOverlay(overlay, anchors, viewBox);

    // ✅ Build provenance before returning
    return {
      markup: markup,
      provenance: instance._getRendererProvenance(overlay.id, {
        overlay_type: overlay.type,
        has_data_source: !!overlay.data_source,
        // Add overlay-specific metadata
      })
    };
  }

  renderOverlay(overlay, anchors, viewBox) {
    // Resolve style properties with tracking
    const color = this._resolveStyleProperty(
      overlay.style?.color,           // explicit value
      'colors.primary',                // token path
      resolveToken,                    // token resolver
      '#FF9900',                       // fallback
      { viewBox: this.viewBox }        // context
    );

    // Generate markup
    return `<g>...</g>`;
  }
}
```

### Requirements for Standalone Renderers

If your renderer doesn't extend BaseRenderer (like ApexChartsOverlayRenderer), implement tracking manually:

```javascript
export class MyStandaloneRenderer {
  constructor() {
    this._trackingInitialized = false;
  }

  static render(overlay, anchors, viewBox, svgContainer, cardInstance) {
    const instance = MyStandaloneRenderer._getInstance();

    // Initialize tracking
    if (!instance._trackingInitialized) {
      instance._defaultsAccessed = [];
      instance._renderStartTime = null;
      instance._featuresUsed = new Set();
      instance._styleResolutions = [];
      instance._trackingInitialized = true;
    }

    // Reset for this render
    instance._defaultsAccessed = [];
    instance._featuresUsed = new Set();
    instance._styleResolutions = [];
    instance._renderStartTime = performance.now();

    // Track features as you use them
    if (overlay.some_feature) {
      instance._featuresUsed.add('some_feature');
    }

    // Track style resolutions
    const color = instance._resolveChartStyleProperty(
      'chart.strokeColor',
      overlay.style?.color,
      themeDefaults.strokeColor,
      '#FF9900'
    );

    // Your rendering logic
    const markup = '...';

    // Build provenance
    return {
      markup: markup,
      provenance: instance._buildProvenance(overlay.id, {
        chart_type: overlay.chart_type,
        has_data_source: !!overlay.data_source
      })
    };
  }

  _resolveChartStyleProperty(property, explicitValue, themeDefault, adapterDefault) {
    const resolution = {
      property,
      explicitValue,
      themeDefault,
      adapterDefault,
      resolved: null,
      source: null
    };

    // Priority 1: Explicit value
    if (explicitValue !== undefined && explicitValue !== null) {
      resolution.resolved = explicitValue;
      resolution.source = 'explicit';
      this._trackStyleResolution(property, resolution);
      return explicitValue;
    }

    // Priority 2: Theme default
    if (themeDefault !== undefined && themeDefault !== null) {
      resolution.resolved = themeDefault;
      resolution.source = 'theme';
      this._trackStyleResolution(property, resolution);
      return themeDefault;
    }

    // Priority 3: Adapter default
    resolution.resolved = adapterDefault;
    resolution.source = 'adapter_default';
    this._trackStyleResolution(property, resolution);
    return adapterDefault;
  }

  _trackStyleResolution(property, resolution) {
    if (!this._styleResolutions) {
      this._styleResolutions = [];
    }

    this._styleResolutions.push({
      property,
      source: resolution.source,
      value: resolution.resolved,
      explicitValue: resolution.explicitValue,
      themeDefault: resolution.themeDefault,
      adapterDefault: resolution.adapterDefault,
      timestamp: performance.now()
    });
  }

  _buildProvenance(overlayId, metadata) {
    const renderDuration = this._renderStartTime ?
      performance.now() - this._renderStartTime : 0;

    return {
      renderer: 'MyStandaloneRenderer',
      extends_base: false,
      overlay_id: overlayId,
      features_used: Array.from(this._featuresUsed),
      style_resolution: this._summarizeStyleResolutions(),
      rendering_time_ms: renderDuration,
      timestamp: Date.now(),
      ...metadata
    };
  }

  _summarizeStyleResolutions() {
    if (!this._styleResolutions || this._styleResolutions.length === 0) {
      return {
        total: 0,
        by_source: {},
        properties: []
      };
    }

    const bySource = {};
    const properties = [];

    this._styleResolutions.forEach(resolution => {
      if (!bySource[resolution.source]) {
        bySource[resolution.source] = 0;
      }
      bySource[resolution.source]++;

      properties.push({
        property: resolution.property,
        source: resolution.source,
        value: resolution.value
      });
    });

    return {
      total: this._styleResolutions.length,
      by_source: bySource,
      properties: properties
    };
  }
}
```

### What to Track

#### Feature Usage (Phase 5.2A)
Track significant features used during rendering:
```javascript
// Visual effects
this._trackFeature('gradient');
this._trackFeature('pattern');
this._trackFeature('glow');
this._trackFeature('shadow');
this._trackFeature('blur');

// LCARS features
this._trackFeature('brackets');
this._trackFeature('preset_lozenge');
this._trackFeature('preset_rounded');

// Data features
this._trackFeature('data_source');
this._trackFeature('chart_template');
this._trackFeature('multi_series');

// Text features
this._trackFeature('texts_array');
this._trackFeature('has_label');
this._trackFeature('has_content');
```

#### Style Resolutions (Phase 5.2B)
Track where style values came from:
```javascript
// Using BaseRenderer (automatic)
const color = this._resolveStyleProperty(
  overlay.style?.color,      // explicit value from config
  'colors.primary',          // token path to resolve
  resolveToken,              // token resolver function
  '#FF9900',                 // fallback default
  { viewBox: this.viewBox }  // context for resolution
);

// Manual tracking (for standalone renderers)
const color = this._resolveChartStyleProperty(
  'chart.strokeColor',           // property name
  overlay.style?.color,          // explicit value
  themeDefaults.strokeColor,     // theme default
  '#FF9900'                      // adapter/fallback default
);
```

#### Performance Tracking (Phase 5.3)
Performance is tracked automatically:
- Just call `_startRenderTiming()` at the start of rendering
- Rendering duration is automatically calculated
- AdvancedRenderer tracks stage-by-stage timing

### Accessing Provenance Data

#### Renderer Information
```javascript
// Get renderer info for an overlay
window.__msdDebug.getRendererInfo('my-overlay-id');

// List all tracked overlays
window.__msdDebug.listTrackedOverlays();
```

#### Style Resolutions
```javascript
// Get style resolutions for an overlay
window.__msdDebug.getStyleResolutions('my-overlay-id');

// Find overlays using a specific token
window.__msdDebug.findOverlaysByToken('colors.primary');

// Get global style summary
window.__msdDebug.getGlobalStyleSummary();
```

#### Performance Metrics
```javascript
// Get complete performance summary
window.__msdDebug.getPerformanceSummary();

// Get slowest overlays
window.__msdDebug.getSlowestOverlays(10);

// Get performance by overlay type
window.__msdDebug.getRendererPerformance();

// Get performance warnings
window.__msdDebug.getPerformanceWarnings();

// Get render timeline
window.__msdDebug.getRenderTimeline();

// Get performance for specific overlay
window.__msdDebug.getOverlayPerformance('my-overlay-id');
```

### Provenance Data Structure

The provenance object returned by renderers includes:

```javascript
{
  // Basic metadata
  renderer: 'MyRenderer',
  extends_base: true,
  overlay_id: 'my-overlay',
  overlay_type: 'text',
  timestamp: 1234567890,

  // Feature tracking (Phase 5.2A)
  features_used: ['gradient', 'glow', 'data_source'],

  // Theme management
  theme_manager_resolved: true,
  theme_manager_source: 'window.cblcars.theme',
  defaults_accessed: [
    { path: 'text.defaultColor', value: '#FF9900', source: 'theme' },
    { path: 'text.fontSize', value: 18, source: 'fallback' }
  ],

  // Style resolution (Phase 5.2B)
  style_resolution: {
    total: 15,
    by_source: {
      explicit: 5,
      token_system: 7,
      fallback: 3
    },
    properties: [
      { property: 'defaultColor', source: 'token_system', value: '#FF9900', token: 'colors.primary' },
      { property: 'fontSize', source: 'explicit', value: 20 }
    ]
  },

  // Performance (Phase 5.3)
  rendering_time_ms: 12.34
}
```

### Performance Thresholds

The system includes built-in performance warnings:

- **Slow Overlay Threshold**: 50ms per overlay
- **Slow Total Render Threshold**: 200ms for complete render

If any overlay exceeds these thresholds, warnings are automatically generated:

```javascript
const warnings = window.__msdDebug.getPerformanceWarnings();
// {
//   has_warnings: true,
//   count: 2,
//   warnings: [
//     {
//       type: 'slow_overlay',
//       severity: 'warning',
//       message: "Overlay 'my-text' (text) took 65.32ms to render",
//       overlay_id: 'my-text',
//       overlay_type: 'text',
//       value: 65.32,
//       threshold: 50
//     }
//   ]
// }
```

### Best Practices

1. **Always track features** - Makes debugging much easier
2. **Use style resolution tracking** - Understand where values come from
3. **Monitor performance** - Catch slow overlays early
4. **Start timing early** - Call `_startRenderTiming()` at render start
5. **Return provenance** - Always return `{ markup, provenance }` structure
6. **Track errors** - Include error information in provenance for failed renders

### Troubleshooting

**Issue: No provenance data available**
- Check that renderer calls `_resetTracking()` and `_getRendererProvenance()`
- Verify overlays are re-rendered after code updates
- Check console for renderer errors

**Issue: Style resolution not tracking**
- Ensure `_resolveStyleProperty()` is being used for all style properties
- Verify token resolver is being passed correctly
- Check that `_trackStyleResolution()` is being called

**Issue: Performance metrics missing**
- Verify `_startRenderTiming()` is called at start of render
- Check that AdvancedRenderer has been updated with Phase 5.3 code
- Ensure overlays have been rendered at least once

**Issue: Feature tracking incomplete**
- Add `_trackFeature()` calls for all significant features
- Review feature usage in similar renderers for examples
- Check that features are tracked before early returns
```

---

## **Update 2: Create Phase 5 Summary Document**

**File: `doc/architecture/phase-5-provenance-system.md`**

Create this new file:

````markdown
# Phase 5: Provenance System

## Overview

The Phase 5 Provenance System provides comprehensive tracking of configuration origins, style resolution, and rendering performance throughout the MSD rendering pipeline. This system enables powerful debugging, optimization, and troubleshooting capabilities.

## Architecture

The provenance system consists of three phases:

### Phase 5.1: Configuration Provenance
Tracks the origin and transformation of configuration data.

**Status:** ✅ Complete

**Features:**
- Pack loading tracking
- Theme resolution tracking
- Configuration merge tracking
- Overlay origin tracking

### Phase 5.2A: Renderer Provenance
Tracks which renderers were used and what features were utilized.

**Status:** ✅ Complete

**Features:**
- Renderer identification
- Feature usage tracking
- Default value tracking
- Theme manager resolution tracking

### Phase 5.2B: Style Resolution Provenance
Tracks where style values came from during rendering.

**Status:** ✅ Complete

**Features:**
- Explicit vs token vs fallback tracking
- Token usage tracking
- Style source analysis
- Global style statistics

### Phase 5.3: Performance Metrics
Tracks detailed performance data for rendering operations.

**Status:** ✅ Complete

**Features:**
- Stage-by-stage timing
- Per-overlay timing
- Performance warnings
- Renderer comparison

### Phase 5.4: Data Flow Tracking
Tracks how data flows through the system.

**Status:** 🔄 Backlogged

### Phase 5.5: Error & Warning Tracking
Comprehensive error and warning collection.

**Status:** 🔄 Backlogged

## Data Structure

### Configuration Provenance

```javascript
config.__provenance = {
  // Theme information
  theme: {
    active_theme: 'lcars-modern',
    requested_theme: 'lcars-modern',
    default_theme: 'lcars-classic',
    source_pack: 'builtin',
    fallback_used: false,
    themes_available: ['lcars-classic', 'lcars-modern'],
    theme_pack_loaded: true
  },

  // Pack information
  packs: {
    builtin: ['base-overlays', 'base-animations'],
    external: [],
    failed: []
  },

  // Overlay origins
  overlays: {
    'my-overlay': {
      origin_pack: 'base-overlays',
      overridden: false
    }
  },

  // Renderer provenance (Phase 5.2A/5.2B)
  renderers: {
    'my-overlay': {
      renderer: 'TextOverlayRenderer',
      extends_base: true,
      overlay_type: 'text',
      features_used: ['gradient', 'glow'],
      style_resolution: { /* ... */ },
      rendering_time_ms: 12.34
    }
  },

  // Performance data (Phase 5.3)
  advanced_renderer: {
    performance: {
      total_render_time_ms: 156.78,
      overlay_count: 12,
      stages: { /* ... */ }
    }
  }
}
```

### Renderer Provenance (Phase 5.2A)

```javascript
{
  renderer: 'TextOverlayRenderer',
  extends_base: true,
  overlay_id: 'my-text',
  overlay_type: 'text',

  // Theme integration
  theme_manager_resolved: true,
  theme_manager_source: 'window.cblcars.theme',

  // Features used
  features_used: [
    'gradient',
    'glow',
    'data_source',
    'preset_lozenge'
  ],

  // Defaults accessed
  defaults_accessed: [
    {
      path: 'text.defaultColor',
      value: '#FF9900',
      source: 'theme',
      reason: 'resolved'
    },
    {
      path: 'text.fontSize',
      value: 18,
      source: 'fallback',
      reason: 'not_in_theme'
    }
  ],

  rendering_time_ms: 12.34,
  timestamp: 1234567890
}
```

### Style Resolution Provenance (Phase 5.2B)

```javascript
{
  style_resolution: {
    total: 15,
    by_source: {
      explicit: 5,        // From overlay config
      token_system: 7,    // From theme tokens
      token_from_style: 1, // Token reference in config
      fallback: 2         // Default fallback
    },
    properties: [
      {
        property: 'defaultColor',
        source: 'token_system',
        value: '#FF9900',
        token: 'colors.primary'
      },
      {
        property: 'fontSize',
        source: 'explicit',
        value: 20
      },
      {
        property: 'borderWidth',
        source: 'fallback',
        value: 1
      }
    ]
  }
}
```

### Performance Provenance (Phase 5.3)

```javascript
{
  performance: {
    total_render_time_ms: 156.78,
    overlay_count: 12,
    average_per_overlay_ms: 13.07,

    stages: {
      preparation_ms: 23.45,
      overlay_rendering_ms: 98.76,
      dom_injection_ms: 34.57,
      action_attachment_ms: 0
    },

    overlay_timings: [
      { overlay_id: 'text-1', type: 'text', duration_ms: 15.34 },
      { overlay_id: 'line-1', type: 'line', duration_ms: 8.92 }
    ],

    slowest_overlays: [
      { overlay_id: 'chart-1', type: 'apexchart', duration_ms: 45.67, percentage_of_total: '29.1' }
    ],

    timestamp: 1234567890
  }
}
```

## Debug Interface

### Configuration Provenance

```javascript
// Theme information
window.__msdDebug.getThemeProvenance();

// Pack information
window.__msdDebug.getPackInfo();

// Overlay origins
window.__msdDebug.getOverlayProvenance('my-overlay');

// List tracked overlays
window.__msdDebug.listTrackedOverlays();
```

### Renderer Provenance (Phase 5.2A)

```javascript
// Get renderer info
window.__msdDebug.getRendererInfo('my-overlay');

// Complete overlay provenance
window.__msdDebug.getOverlayProvenance('my-overlay');
```

### Style Resolution (Phase 5.2B)

```javascript
// Style resolutions for an overlay
window.__msdDebug.getStyleResolutions('my-overlay');

// Find overlays using a token
window.__msdDebug.findOverlaysByToken('colors.primary');

// Global style summary
window.__msdDebug.getGlobalStyleSummary();
```

### Performance Metrics (Phase 5.3)

```javascript
// Complete performance summary
window.__msdDebug.getPerformanceSummary();

// Slowest overlays
window.__msdDebug.getSlowestOverlays(10);

// Performance by type
window.__msdDebug.getRendererPerformance();

// Performance warnings
window.__msdDebug.getPerformanceWarnings();

// Render timeline
window.__msdDebug.getRenderTimeline();

// Specific overlay performance
window.__msdDebug.getOverlayPerformance('my-overlay');

// Compare renderers
window.__msdDebug.compareRendererPerformance();
```

## Use Cases

### Debugging Style Issues

**Problem:** "Why is my text overlay orange instead of blue?"

```javascript
// 1. Check style resolutions
const resolutions = window.__msdDebug.getStyleResolutions('my-text');

// 2. Find the color property
const colorProp = resolutions.properties.find(p => p.property === 'defaultColor');
console.log('Color source:', colorProp.source);
console.log('Color value:', colorProp.value);
console.log('Token used:', colorProp.token);

// 3. Find other overlays using same token
if (colorProp.token) {
  window.__msdDebug.findOverlaysByToken(colorProp.token);
}
```

### Optimizing Performance

**Problem:** "My MSD is rendering slowly"

```javascript
// 1. Get performance summary
const perf = window.__msdDebug.getPerformanceSummary();

// 2. Check for warnings
const warnings = window.__msdDebug.getPerformanceWarnings();

// 3. Identify slowest overlays
const slowest = window.__msdDebug.getSlowestOverlays(5);

// 4. Analyze by type
const byType = window.__msdDebug.getRendererPerformance();

// 5. Get timeline breakdown
const timeline = window.__msdDebug.getRenderTimeline();
```

### Verifying Theme Application

**Problem:** "Are my theme tokens being applied?"

```javascript
// 1. Check theme provenance
window.__msdDebug.getThemeProvenance();

// 2. Get global style summary
const summary = window.__msdDebug.getGlobalStyleSummary();

// 3. Check percentage from tokens
const tokenPercent = (summary.by_source.token_system / summary.total_resolutions) * 100;
console.log(`${tokenPercent.toFixed(1)}% of styles from theme tokens`);

// 4. Find overlays NOT using tokens
const allOverlays = window.__msdDebug.listTrackedOverlays();
allOverlays.forEach(id => {
  const resolutions = window.__msdDebug.getStyleResolutions(id);
  if (!resolutions.properties.some(p => p.source.includes('token'))) {
    console.log(`${id} not using any tokens`);
  }
});
```

### Tracking Configuration Origin

**Problem:** "Where did this overlay come from?"

```javascript
// 1. Get overlay provenance
const prov = window.__msdDebug.getOverlayProvenance('my-overlay');

// 2. Check origin
console.log('Origin pack:', prov.overlay.origin_pack);
console.log('Overridden:', prov.overlay.overridden);
if (prov.overlay.overridden) {
  console.log('Override layer:', prov.overlay.override_layer);
}

// 3. Get pack info
window.__msdDebug.getPackInfo();
```

## Performance Optimization Guidelines

### Performance Thresholds

- **Per Overlay:** < 50ms (warning if exceeded)
- **Total Render:** < 200ms (warning if exceeded)
- **Preparation Stage:** < 30ms
- **Overlay Rendering Stage:** < 150ms
- **DOM Injection Stage:** < 20ms

### Optimization Strategies

1. **Reduce Complex Overlays**
   - Simplify SVG markup
   - Remove unnecessary effects
   - Optimize path data

2. **Minimize DOM Operations**
   - Batch DOM updates
   - Use `innerHTML` over repeated `appendChild`
   - Cache DOM elements

3. **Optimize Style Resolution**
   - Use explicit values for frequently changed properties
   - Cache theme token resolutions
   - Avoid nested token lookups

4. **Reduce Overlay Count**
   - Combine related overlays
   - Use status grids instead of multiple text overlays
   - Simplify line routing

## Future Enhancements

### Phase 5.4: Data Flow Tracking (Backlogged)

Will track:
- DataSource subscriptions
- Template resolution
- Entity state changes
- Update propagation

### Phase 5.5: Error & Warning Tracking (Backlogged)

Will track:
- Configuration errors
- Runtime errors
- Validation warnings
- Missing dependencies

## Implementation Checklist

When implementing provenance in a new renderer:

- [ ] Extend BaseRenderer or implement tracking manually
- [ ] Set `this.rendererName` in constructor
- [ ] Call `_resetTracking()` at render start
- [ ] Call `_startRenderTiming()` after reset
- [ ] Track features with `_trackFeature()`
- [ ] Use `_resolveStyleProperty()` for all style values
- [ ] Return `{ markup, provenance }` structure
- [ ] Include overlay-specific metadata in provenance
- [ ] Test with `window.__msdDebug.getRendererInfo()`
- [ ] Verify style resolutions with `window.__msdDebug.getStyleResolutions()`
- [ ] Check performance with `window.__msdDebug.getOverlayPerformance()`

## Related Documentation

- [Overlay Implementation Guide](../spec/overlay-implementation-guide.md)
- [BaseRenderer API](../api/base-renderer.md) (if exists)
- [Debug Interface](../api/debug-interface.md) (if exists)
- [Theme System](../architecture/theme-system.md) (if exists)
````

---

## **Update 3: Update Help Commands**

The help and usage commands in DebugInterface.js should already be updated from Step 3. Verify they include the Phase 5.3 commands.

---

## ✅ **Documentation Complete!**

You now have:
1. ✅ Updated Overlay Implementation Guide with complete Phase 5 instructions
2. ✅ New Phase 5 Provenance System document with architecture and use cases
3. ✅ Debug command documentation
4. ✅ Performance optimization guidelines

---

## **Next Steps**

Now you can:

1. **Backlog Phase 5.4 & 5.5** - Create GitHub issues for future work
2. **Move to Style Resolver Service** - Begin architecture design
3. **Move to Unified Validation System** - Begin architecture design

**Would you like me to:**
- **A)** Create GitHub issue templates for Phase 5.4 & 5.5?
- **B)** Start Style Resolver Service architecture document?
- **C)** Start Unified Validation System architecture document?
- **D)** Something else?

Let me know how you'd like to proceed! 🚀