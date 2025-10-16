# MSD ApexCharts Enhancement Proposal

**Version:** 1.0.0  
**Date:** 2025-01-16  
**Status:** Proposed  
**Author:** CB-LCARS MSD Team

---

## Executive Summary

This proposal outlines a comprehensive enhancement plan for the MSD ApexCharts integration, introducing four major feature areas that will significantly expand charting capabilities while maintaining architectural consistency with existing MSD systems.

**Key Enhancements:**
1. **Chart Templates & Presets** - Reusable chart configurations via pack system
2. **Theme System** - Unified theming with palettes and chart-specific styling
3. **Additional Chart Types** - Expand from 7 to 15 ApexCharts types
4. **Chart Synchronization** - Custom sync system for shadow DOM compatibility

**Architecture Goals:**
- Zero breaking changes to existing code
- Full integration with MSD pack system
- Forward compatibility with animation system (future work)
- Professional documentation and examples

---

## Table of Contents

1. [Background & Context](#1-background--context)
2. [Feature 1: Chart Templates & Presets](#2-feature-1-chart-templates--presets)
3. [Feature 2: Theme System](#3-feature-2-theme-system)
4. [Feature 3: Additional Chart Types](#4-feature-3-additional-chart-types)
5. [Feature 4: Chart Synchronization](#5-feature-4-chart-synchronization)
6. [Animation System Integration (Future)](#6-animation-system-integration-future)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Technical Architecture](#8-technical-architecture)
9. [Code Deliverables](#9-code-deliverables)
10. [Documentation Requirements](#10-documentation-requirements)
11. [Testing Strategy](#11-testing-strategy)
12. [Migration & Compatibility](#12-migration--compatibility)

---

## 1. Background & Context

### 1.1 Current State

The MSD ApexCharts integration (implemented in `ea7ada21`) provides:
- ✅ 7 chart types (line, area, bar, scatter, candlestick, heatmap, radar)
- ✅ Real-time DataSource integration with subscriptions
- ✅ Multi-series support
- ✅ Direct ApexCharts API access via `chart_options`
- ✅ Theme-aware default styling

### 1.2 Identified Gaps

Based on code review and architectural analysis:

1. **Configuration Repetition**: Users must repeat common chart configurations
2. **Limited Theming**: No unified theme system across MSD
3. **Chart Type Coverage**: Only 7/15 ApexCharts types available
4. **No Synchronization**: Multi-panel dashboards lack coordinated interactions
5. **Animation Disconnect**: Animation system not yet integrated

### 1.3 Integration Points

This proposal builds on existing infrastructure:

```javascript
// Existing Systems (Already Implemented)
- PackRegistry (src/msd/packs/PackRegistry.js)
- StylePresetManager (src/msd/presets/StylePresetManager.js)
- DefaultsManager (src/msd/pipeline/MsdDefaultsManager.js)
- ApexChartsAdapter (src/msd/charts/ApexChartsAdapter.js)
- ApexChartsOverlayRenderer (src/msd/renderer/ApexChartsOverlayRenderer.js)

// New Systems (This Proposal)
- ChartTemplateRegistry
- ThemeSystem
- ChartSyncManager
```

---

## 2. Feature 1: Chart Templates & Presets

### 2.1 Overview

**Goal:** Enable DRY chart configurations through reusable templates stored in packs.

**Value Proposition:**
- Reduce configuration duplication
- Standardize chart appearances across dashboards
- Simplify user experience for common patterns

### 2.2 Architecture

#### 2.2.1 ChartTemplateRegistry

New registry system for managing chart templates:

```javascript
// src/msd/templates/ChartTemplateRegistry.js

export class ChartTemplateRegistry {
  constructor() {
    this.templates = new Map();
    this.packTemplates = new Map();
    this._registerBuiltinTemplates();
  }

  register(name, config) { /* ... */ }
  registerFromPack(packId, chartTemplates) { /* ... */ }
  get(name) { /* ... */ }
  applyTemplate(overlay) { /* ... */ }
  listTemplates(packId = null) { /* ... */ }
}
```

**Key Methods:**
- `register()` - Register a single template
- `registerFromPack()` - Load templates from pack definition
- `applyTemplate()` - Deep merge template into overlay config
- `listTemplates()` - List available templates by pack

#### 2.2.2 Pack Structure Enhancement

Extend existing pack structure to include `chartTemplates`:

```javascript
// Example: src/msd/packs/loadBuiltinPacks.js

const builtinPack = {
  id: 'builtin',
  version: '1.0.0',
  
  // Existing properties
  styles: { ... },
  colors: { ... },
  defaults: { ... },
  
  // NEW: Chart templates
  chartTemplates: {
    temperature_monitor: {
      style: {
        chart_type: 'line',
        color: 'var(--lcars-blue)',
        stroke_width: 3,
        smoothing_mode: 'smooth',
        time_window: '12h',
        max_points: 500,
        show_grid: true,
        show_axis: true,
        thresholds: [
          { value: 15, color: 'var(--lcars-blue)', label: 'Cold' },
          { value: 20, color: 'var(--lcars-green)', label: 'Comfortable' },
          { value: 25, color: 'var(--lcars-orange)', label: 'Warm' },
          { value: 30, color: 'var(--lcars-red)', label: 'Hot' }
        ]
      }
    },
    power_monitor: {
      style: {
        chart_type: 'area',
        color: 'var(--lcars-yellow)',
        fill_opacity: 0.3,
        stroke_width: 2,
        time_window: '24h',
        zero_line: true,
        min_value: 0
      }
    },
    realtime_minimal: {
      style: {
        chart_type: 'line',
        stroke_width: 2,
        time_window: '5m',
        max_points: 200,
        show_grid: false,
        show_axis: false,
        show_labels: false,
        animatable: true
      }
    }
  }
};
```

#### 2.2.3 Template Application

Templates are resolved during overlay processing:

```javascript
// Integration with OverlayProcessor (conceptual)

function processOverlay(overlay) {
  // Apply template if specified
  if (overlay.type === 'apexchart' && overlay.template) {
    overlay = chartTemplateRegistry.applyTemplate(overlay);
  }
  
  // Continue with normal processing...
  return overlay;
}
```

### 2.3 User-Facing YAML

#### 2.3.1 Using Built-in Templates

```yaml
overlays:
  # Use built-in template
  - id: temp_chart_1
    type: apexchart
    template: "temperature_monitor"  # Reference template
    source: living_room_temp
    position: [50, 100]
    size: [300, 150]
    style:
      # Override specific properties if needed
      thresholds:
        - value: 22  # Different target for living room

  # Use pack-specific template
  - id: power_chart
    type: apexchart
    template: "tng:engineering_power_display"  # Pack-namespaced
    source: power_meter
    position: [50, 270]
    size: [400, 200]
```

#### 2.3.2 Template Inheritance

Templates support deep merging with overlay-specific overrides:

```yaml
overlays:
  - id: custom_temp_chart
    type: apexchart
    template: "temperature_monitor"
    source: outdoor_temp
    position: [50, 100]
    size: [300, 150]
    style:
      # Template provides base config
      # Overlay overrides specific values
      color: "var(--lcars-purple)"  # Override color
      thresholds:  # Replace entire thresholds array
        - value: 0
          color: "var(--lcars-blue)"
          label: "Freezing"
```

### 2.4 Built-in Templates

Proposal includes 6 built-in templates in `core` pack:

| Template ID | Type | Purpose | Key Features |
|-------------|------|---------|--------------|
| `temperature_monitor` | line | Temperature tracking | Multi-threshold, 12h window |
| `power_monitor` | area | Power consumption | Zero line, 24h window |
| `realtime_minimal` | line | Real-time sensor | Minimal UI, 5m window |
| `historical_trend` | line | Long-term analysis | Zoom/pan enabled, 7d window |
| `multi_sensor_comparison` | line | Compare sensors | Legend, 4-color palette |
| `status_bars` | bar | Status visualization | Values shown, no grid |

### 2.5 Integration Points

**Files to Modify:**
1. `src/msd/templates/ChartTemplateRegistry.js` (NEW)
2. `src/msd/packs/loadBuiltinPacks.js` (enhance `builtinPack`)
3. `src/msd/packs/PackManager.js` (call `registerFromPack()`)
4. `src/msd/renderer/OverlayProcessor.js` (apply templates in pipeline)

**Initialization Sequence:**
```javascript
// In PackManager.loadPack()
if (pack.chartTemplates) {
  chartTemplateRegistry.registerFromPack(pack.id, pack.chartTemplates);
}
```

### 2.6 Benefits

1. **DRY Configurations**: Define once, use many times
2. **Standardization**: Consistent chart appearances
3. **Pack Extensibility**: Custom packs can provide specialized templates
4. **Maintainability**: Update template → all instances update
5. **Discoverability**: `listTemplates()` API for UI builders

---

## 3. Feature 2: Theme System

### 3.1 Overview

**Goal:** Unified theming system that coordinates color schemes (palettes) with chart-specific styling.

**Architecture:** `Themes = Palettes + Chart Themes + (future: Layout Preferences)`

### 3.2 Components

#### 3.2.1 Palette System (Colors)

**Palettes** define color schemes as CSS custom properties:

```javascript
palette: {
  colors: {
    'orange': '#FF9900',
    'blue': '#9999FF',
    'purple': '#CC99CC',
    'yellow': '#FFCC99',
    'red': '#CC6666',
    'green': '#99CC99',
    'gray': '#999999',
    'white': '#FFFFFF',
    'black': '#000000',
    'background': '#000000'
  }
}
```

**Applied as:**
```css
:root {
  --lcars-orange: #FF9900;
  --lcars-blue: #9999FF;
  /* ... */
}
```

#### 3.2.2 Chart Theme (ApexCharts Styling)

**Chart Themes** define ApexCharts-specific styling defaults:

```javascript
chartTheme: {
  colors: [
    '#FF9900',  // orange
    '#9999FF',  // blue
    '#FFCC99',  // yellow
    '#CC99CC',  // purple
    '#99CC99',  // green
    '#CC6666'   // red
  ],
  stroke: {
    width: 3,
    curve: 'smooth',
    lineCap: 'round'
  },
  fill: {
    opacity: 0.2
  },
  grid: {
    borderColor: '#999999',
    strokeDashArray: 4,
    opacity: 0.3
  },
  markers: {
    size: 4,
    strokeWidth: 0
  },
  tooltip: {
    theme: 'dark',
    style: {
      fontSize: '12px',
      fontFamily: 'Antonio, sans-serif'
    }
  },
  legend: {
    fontSize: '12px',
    fontFamily: 'Antonio, sans-serif',
    labels: {
      colors: '#FFFFFF'
    }
  },
  xaxis: {
    labels: {
      style: {
        colors: '#FFFFFF',
        fontSize: '10px',
        fontFamily: 'Antonio, sans-serif'
      }
    }
  },
  yaxis: {
    labels: {
      style: {
        colors: '#FFFFFF',
        fontSize: '10px',
        fontFamily: 'Antonio, sans-serif'
      }
    }
  }
}
```

#### 3.2.3 Theme Object

**Complete Theme** combines palette + chart theme:

```javascript
{
  id: 'lcars-classic',
  name: 'LCARS Classic',
  description: 'Classic TNG-era LCARS styling',
  palette: { /* ... */ },
  chartTheme: { /* ... */ }
}
```

### 3.3 ThemeSystem Implementation

```javascript
// src/msd/themes/ThemeSystem.js

export class ThemeSystem {
  constructor() {
    this.themes = new Map();
    this.currentTheme = 'lcars-classic';
    this._registerBuiltinThemes();
  }

  register(id, theme) {
    this.themes.set(id, {
      id,
      name: theme.name || id,
      description: theme.description || '',
      palette: theme.palette || {},
      chartTheme: theme.chartTheme || {},
      packId: theme.packId || 'builtin'
    });
  }

  apply(themeId, rootElement = null) {
    const theme = this.themes.get(themeId);
    if (!theme) return;

    this.currentTheme = themeId;

    // Apply palette CSS variables
    this._applyPalette(theme.palette, rootElement);

    // Store chart theme for ApexChartsAdapter
    window.__msdChartTheme = theme.chartTheme;

    // Dispatch event for other systems
    window.dispatchEvent(new CustomEvent('msd-theme-changed', {
      detail: { themeId, theme }
    }));
  }

  getChartTheme(themeId = null) {
    const theme = this.themes.get(themeId || this.currentTheme);
    return theme?.chartTheme || {};
  }

  getPalette(themeId = null) {
    const theme = this.themes.get(themeId || this.currentTheme);
    return theme?.palette || {};
  }

  listThemes(packId = null) {
    const themeList = [];
    this.themes.forEach((theme, id) => {
      if (!packId || theme.packId === packId) {
        themeList.push({
          id: theme.id,
          name: theme.name,
          description: theme.description,
          packId: theme.packId
        });
      }
    });
    return themeList;
  }
}
```

### 3.4 Built-in Themes

Proposal includes 4 built-in themes in `core` pack:

#### 3.4.1 LCARS Classic (TNG)

```javascript
{
  id: 'lcars-classic',
  name: 'LCARS Classic',
  description: 'Classic TNG-era LCARS styling',
  palette: {
    colors: {
      'orange': '#FF9900',
      'blue': '#9999FF',
      // ... (full palette)
    }
  },
  chartTheme: {
    colors: ['#FF9900', '#9999FF', '#FFCC99', '#CC99CC', '#99CC99', '#CC6666'],
    stroke: { width: 3, curve: 'smooth', lineCap: 'round' },
    // ... (full chart theme)
  }
}
```

#### 3.4.2 LCARS DS9

```javascript
{
  id: 'lcars-ds9',
  name: 'LCARS DS9',
  description: 'Deep Space Nine LCARS variant with angular aesthetic',
  palette: {
    colors: {
      'orange': '#FF6633',
      'blue': '#6699FF',
      // ... (adjusted palette)
    }
  },
  chartTheme: {
    colors: ['#FF6633', '#6699FF', '#FFCC33', '#9966CC', '#66CC66', '#FF3333'],
    stroke: { width: 2, curve: 'straight', lineCap: 'square' },  // Angular
    // ...
  }
}
```

#### 3.4.3 LCARS Voyager

```javascript
{
  id: 'lcars-voyager',
  name: 'LCARS Voyager',
  description: 'Voyager LCARS styling with prominent blues',
  palette: {
    colors: {
      'orange': '#FF9933',
      'blue': '#3399FF',  // More prominent
      // ...
    }
  },
  chartTheme: {
    colors: ['#3399FF', '#FF9933', '#FFCC66', '#9966FF', '#66FF66', '#FF6666'],
    // Blue first for Voyager prominence
    fill: { type: 'gradient' },  // Voyager aesthetic
    // ...
  }
}
```

#### 3.4.4 LCARS High Contrast (Accessibility)

```javascript
{
  id: 'lcars-high-contrast',
  name: 'LCARS High Contrast',
  description: 'High contrast theme for accessibility',
  palette: {
    colors: {
      'orange': '#FFAA00',  // Brighter
      'blue': '#00AAFF',
      'yellow': '#FFFF00',
      // ... (high contrast colors)
    }
  },
  chartTheme: {
    colors: ['#FFFF00', '#00AAFF', '#FFAA00', '#00FF00', '#FF0000', '#AA00FF'],
    stroke: { width: 4 },  // Thicker for visibility
    markers: { size: 6, strokeWidth: 2 },  // Larger markers
    dataLabels: { enabled: true },  // Show values
    // ...
  }
}
```

### 3.5 Theme Application in ApexChartsAdapter

Enhanced `generateOptions()` to apply theme defaults:

```javascript
// src/msd/charts/ApexChartsAdapter.js (enhancement)

static generateOptions(style, size, context = {}) {
  // Get active chart theme
  const chartTheme = context.theme || 
                     themeSystem.getChartTheme(context.themeId) || 
                     {};

  // Apply theme defaults FIRST
  const baseOptions = this._applyChartTheme(chartTheme, {
    chart: { /* ... */ },
    stroke: { /* ... */ },
    // ... existing base options
  });

  // Then apply MSD-style config (overrides theme)
  const mergedOptions = this._applyMsdStyleConfig(style, baseOptions);

  // Finally apply chart_options (highest precedence)
  if (style.chart_options) {
    return this._deepMerge(mergedOptions, style.chart_options);
  }

  return mergedOptions;
}

static _applyChartTheme(theme, baseOptions) {
  if (!theme || Object.keys(theme).length === 0) {
    return baseOptions;
  }

  const themedOptions = JSON.parse(JSON.stringify(baseOptions));

  // Apply theme colors
  if (theme.colors && Array.isArray(theme.colors)) {
    themedOptions.colors = theme.colors;
  }

  // Apply theme stroke
  if (theme.stroke) {
    themedOptions.stroke = {
      ...themedOptions.stroke,
      ...theme.stroke
    };
  }

  // ... (merge other theme properties)

  return themedOptions;
}
```

### 3.6 User-Facing YAML

```yaml
type: custom:cb-lcars-msd
pack: tng
theme: lcars-classic  # Apply specific theme

msd:
  overlays:
    - id: temp_chart
      type: apexchart
      source: temperature
      position: [50, 100]
      size: [300, 150]
      # Chart automatically uses lcars-classic theme colors and styling
```

**Runtime Theme Switching:**

```javascript
// JavaScript API for theme switching
window.cblcars.theme.apply('lcars-ds9');
```

### 3.7 Pack Integration

Enhanced pack structure with themes:

```javascript
const builtinPack = {
  id: 'builtin',
  version: '1.0.0',
  
  // Existing properties
  styles: { ... },
  colors: { ... },
  defaults: { ... },
  chartTemplates: { ... },
  
  // NEW: Theme definitions
  themes: {
    'lcars-classic': {
      palette: { /* ... */ },
      chartTheme: { /* ... */ }
    },
    'lcars-ds9': {
      palette: { /* ... */ },
      chartTheme: { /* ... */ }
    },
    'lcars-voyager': {
      palette: { /* ... */ },
      chartTheme: { /* ... */ }
    },
    'lcars-high-contrast': {
      palette: { /* ... */ },
      chartTheme: { /* ... */ }
    }
  },
  
  // NEW: Default theme for this pack
  defaultTheme: 'lcars-classic'
};
```

**Pack Loading with Themes:**

```javascript
// src/msd/packs/PackManager.js (enhancement)

loadPack(pack) {
  // Existing pack loading...
  
  // Load themes
  if (pack.themes) {
    Object.entries(pack.themes).forEach(([id, theme]) => {
      themeSystem.register(id, {
        id,
        ...theme,
        packId: pack.id
      });
    });
  }
  
  // Apply default theme if specified
  if (pack.defaultTheme) {
    themeSystem.apply(pack.defaultTheme);
  }
}
```

### 3.8 Configuration Precedence

**Styling Priority (highest to lowest):**

1. **User overlay `chart_options`** - Direct ApexCharts API
2. **User overlay `style`** - MSD-style properties
3. **Chart templates** - Reusable configurations
4. **Chart themes** - Theme-specific styling
5. **Pack defaults** - Pack-level defaults
6. **Built-in defaults** - System fallbacks

**Example Resolution:**

```yaml
# Pack: TNG
pack: tng
theme: lcars-classic

overlays:
  - id: temp_chart
    type: apexchart
    template: "temperature_monitor"  # Step 3
    source: temperature
    style:
      color: "var(--lcars-red)"  # Step 2 (overrides template)
    chart_options:
      stroke:
        width: 5  # Step 1 (overrides everything)
```

**Resolution Order:**
1. Start with **built-in defaults**
2. Apply **pack defaults**
3. Apply **chart theme** (lcars-classic)
4. Apply **chart template** (temperature_monitor)
5. Apply **user style** (color override)
6. Apply **chart_options** (stroke width override)

### 3.9 Integration Points

**Files to Create:**
1. `src/msd/themes/ThemeSystem.js` (NEW)
2. `src/msd/themes/Palette.js` (helper class, OPTIONAL)
3. `src/msd/themes/ChartTheme.js` (helper class, OPTIONAL)

**Files to Modify:**
1. `src/msd/charts/ApexChartsAdapter.js` (add theme support)
2. `src/msd/packs/loadBuiltinPacks.js` (add themes to packs)
3. `src/msd/packs/PackManager.js` (load themes)

**Initialization Sequence:**
```javascript
// In PackManager.loadPack()
if (pack.themes) {
  Object.entries(pack.themes).forEach(([id, theme]) => {
    themeSystem.register(id, { id, ...theme, packId: pack.id });
  });
}

if (pack.defaultTheme) {
  themeSystem.apply(pack.defaultTheme);
}
```

### 3.10 Benefits

1. **Unified Styling**: Consistent appearance across all MSD components
2. **LCARS Authenticity**: Era-specific themes (TNG, DS9, VOY)
3. **Accessibility**: High contrast theme for users with visual needs
4. **Customization**: Packs can define custom themes
5. **Runtime Switching**: Change themes dynamically without reload

---

## 4. Feature 3: Additional Chart Types

### 4.1 Overview

**Goal:** Expand chart type support from 7 to all 15 ApexCharts types with LCARS-optimized defaults.

**Current Coverage:** 7/15 types  
**Proposed Coverage:** 15/15 types

### 4.2 Chart Types Analysis

#### 4.2.1 Currently Supported (7)

| Type | Status | Use Cases |
|------|--------|-----------|
| `line` | ✅ Supported | Time series, trends |
| `area` | ✅ Supported | Filled regions, power usage |
| `bar` | ✅ Supported | Comparisons, status |
| `scatter` | ✅ Supported | Correlations, distributions |
| `candlestick` | ✅ Supported | Financial data (rarely used in LCARS) |
| `heatmap` | ✅ Supported | Matrix data, schedules |
| `radar` | ✅ Supported | Multi-dimensional comparisons |

#### 4.2.2 Proposed Additions (8)

| Priority | Type | LCARS Use Cases | Implementation Notes |
|----------|------|-----------------|---------------------|
| **HIGH** | `radialBar` | Shield strength, system power, warp core status | Circular displays are very LCARS-aesthetic |
| **HIGH** | `rangeBar` | System uptime, maintenance schedules, mission timelines | Timeline displays for starship operations |
| **HIGH** | `pie` / `donut` | Power distribution, resource allocation | Circular displays common in LCARS |
| **HIGH** | `rangeArea` | Temperature ranges, acceptable operating parameters | Show min/max acceptable values |
| **MEDIUM** | `bubble` | Multi-dimensional sensor data | Sensor range vs power vs sensitivity |
| **LOW** | `treemap` | Hierarchical data | Ship systems breakdown, crew roster |
| **LOW** | `boxPlot` | Statistical analysis | Environmental data distribution |

### 4.3 Implementation Strategy

#### 4.3.1 Update Validation

```javascript
// src/msd/charts/ApexChartsAdapter.js (update)

static generateOptions(style, size, context = {}) {
  const chartType = style.chart_type || style.type || 'line';

  // UPDATED: Expanded valid types
  const validTypes = [
    'line', 'area', 'bar', 'scatter', 'candlestick', 'heatmap', 'radar',
    'bubble', 'pie', 'donut', 'radialBar', 'rangeBar', 'rangeArea', 
    'treemap', 'boxPlot'
  ];

  if (!validTypes.includes(chartType)) {
    cblcarsLog.warn(`[ApexChartsAdapter] Invalid chart type: ${chartType}, defaulting to 'line'`);
  }

  // ... rest of method
}
```

#### 4.3.2 Chart-Type-Specific Defaults

Add LCARS-optimized defaults for each new chart type:

```javascript
// src/msd/charts/ApexChartsAdapter.js (add to generateOptions)

switch (chartType) {
  case 'radialBar':
    baseOptions.plotOptions = {
      radialBar: {
        hollow: {
          size: '60%'
        },
        dataLabels: {
          name: {
            show: true,
            fontSize: '14px',
            fontFamily: 'Antonio',
            color: 'var(--lcars-white)'
          },
          value: {
            show: true,
            fontSize: '24px',
            fontFamily: 'Antonio',
            color: 'var(--lcars-orange)',
            formatter: style.value_format ? 
              (val) => this._formatValue(val, style.value_format) : undefined
          }
        },
        track: {
          background: 'var(--lcars-gray)',
          strokeWidth: '100%',
          opacity: 0.3
        }
      }
    };
    break;

  case 'pie':
  case 'donut':
    baseOptions.plotOptions = {
      pie: {
        donut: {
          size: chartType === 'donut' ? '60%' : '0%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '14px',
              fontFamily: 'Antonio'
            },
            value: {
              show: true,
              fontSize: '18px',
              fontFamily: 'Antonio',
              formatter: style.value_format ? 
                (val) => this._formatValue(val, style.value_format) : undefined
            },
            total: {
              show: true,
              label: 'Total',
              fontSize: '16px',
              fontFamily: 'Antonio',
              color: 'var(--lcars-white)'
            }
          }
        }
      }
    };
    baseOptions.legend = {
      ...baseOptions.legend,
      show: true,  // Legends important for pie charts
      position: style.legend_position || 'right'
    };
    break;

  case 'rangeBar':
    baseOptions.plotOptions = {
      bar: {
        horizontal: true,
        barHeight: '70%',
        rangeBarOverlap: false,
        rangeBarGroupRows: false
      }
    };
    baseOptions.xaxis = {
      ...baseOptions.xaxis,
      type: 'datetime'
    };
    break;

  case 'rangeArea':
    baseOptions.stroke = {
      ...baseOptions.stroke,
      curve: 'straight',  // Range areas look better with straight lines
      width: [0, 2, 2, 0]  // Different widths for range boundaries
    };
    baseOptions.fill = {
      ...baseOptions.fill,
      type: 'solid',
      opacity: 0.3
    };
    break;

  case 'bubble':
    baseOptions.markers = {
      size: style.bubble_size || 8,
      strokeWidth: 0,
      hover: {
        sizeOffset: 3
      }
    };
    baseOptions.dataLabels = {
      enabled: false  // Usually too cluttered for bubbles
    };
    break;

  case 'treemap':
    baseOptions.plotOptions = {
      treemap: {
        enableShades: true,
        shadeIntensity: 0.5,
        distributed: true,
        colorScale: {
          ranges: [
            { from: 0, to: 25, color: 'var(--lcars-blue)' },
            { from: 25, to: 50, color: 'var(--lcars-green)' },
            { from: 50, to: 75, color: 'var(--lcars-orange)' },
            { from: 75, to: 100, color: 'var(--lcars-red)' }
          ]
        }
      }
    };
    break;

  case 'boxPlot':
    baseOptions.plotOptions = {
      boxPlot: {
        colors: {
          upper: style.color || 'var(--lcars-blue)',
          lower: style.color || 'var(--lcars-blue)'
        }
      }
    };
    break;
}
```

### 4.4 LCARS-Specific Examples

#### 4.4.1 Radial Bar - Shield Strength

```yaml
overlays:
  - id: shield_strength
    type: apexchart
    source: shield_power_percent
    position: [50, 100]
    size: [150, 150]
    style:
      chart_type: "radialBar"
      min_value: 0
      max_value: 100
      value_format: "{value}%"
      chart_options:
        colors: ['var(--lcars-blue)']
        plotOptions:
          radialBar:
            startAngle: -90
            endAngle: 90
            dataLabels:
              name:
                offsetY: -10
                text: "SHIELDS"
```

#### 4.4.2 Range Bar - Maintenance Schedule

```yaml
overlays:
  - id: maintenance_schedule
    type: apexchart
    source: maintenance_data
    position: [50, 100]
    size: [400, 200]
    style:
      chart_type: "rangeBar"
      show_legend: true
      chart_options:
        colors: [
          'var(--lcars-blue)',
          'var(--lcars-orange)',
          'var(--lcars-red)'
        ]
        plotOptions:
          bar:
            horizontal: true
            barHeight: '80%'
```

#### 4.4.3 Donut - Power Distribution

```yaml
overlays:
  - id: power_distribution
    type: apexchart
    source: [engine_power, life_support, shields, weapons]
    position: [50, 100]
    size: [200, 200]
    style:
      chart_type: "donut"
      series_names:
        engine_power: "Engines"
        life_support: "Life Support"
        shields: "Shields"
        weapons: "Weapons"
      show_legend: true
      legend_position: "bottom"
      chart_options:
        colors: [
          'var(--lcars-yellow)',
          'var(--lcars-blue)',
          'var(--lcars-green)',
          'var(--lcars-red)'
        ]
```

### 4.5 Documentation Requirements

For each new chart type, document:

1. **Use Cases** - When to use this chart type
2. **Configuration Examples** - Basic and advanced YAML
3. **LCARS Applications** - Star Trek UI equivalents
4. **Style Properties** - Type-specific style options
5. **Limitations** - What doesn't work well

### 4.6 Benefits

1. **Complete Coverage**: Access to all ApexCharts visualization types
2. **LCARS Authenticity**: Circular displays (radialBar, donut) match LCARS aesthetic
3. **Timeline Visualization**: Range bars for starship operations
4. **Flexibility**: Right chart for every data type
5. **Future-Proof**: No need to add more chart types later

---

## 5. Feature 4: Chart Synchronization

### 5.1 Overview

**Goal:** Enable synchronized interactions between multiple charts for coordinated dashboard experiences.

**Challenge:** Native ApexCharts syncing doesn't work in shadow DOM.

**Solution:** Custom MSD-specific sync system compatible with shadow DOM architecture.

### 5.2 Feasibility Analysis

#### 5.2.1 Native ApexCharts Syncing

**How it works:**
```javascript
// Native ApexCharts (doesn't work in shadow DOM)
var chart1 = new ApexCharts(document.querySelector("#chart1"), {
  chart: {
    id: 'chart1',
    group: 'social',  // Group identifier
    type: 'line'
  }
});

var chart2 = new ApexCharts(document.querySelector("#chart2"), {
  chart: {
    id: 'chart2',
    group: 'social',  // Same group = synced
    type: 'area'
  }
});
```

**Limitations for MSD:**
- ❌ Shadow DOM isolation breaks event propagation
- ❌ foreignObject nesting complicates event bubbling
- ❌ Multiple MSD instances have separate shadow roots
- ❌ No documented shadow DOM support

**Verdict:** Native syncing **NOT feasible** for MSD architecture.

#### 5.2.2 Custom MSD Sync System

**Feasibility:** ✅ **HIGH - 9/10**

**Why it's achievable:**
1. ✅ Full control over chart lifecycle
2. ✅ Access to all chart instances via `ApexChartsOverlayRenderer.charts`
3. ✅ Can implement custom event system
4. ✅ Works within shadow DOM constraints
5. ✅ Can sync across multiple MSD instances via global registry

### 5.3 Architecture

#### 5.3.1 ChartSyncManager

```javascript
// src/msd/charts/ChartSyncManager.js

export class ChartSyncManager {
  constructor() {
    // Global registry (works across shadow roots)
    this.syncGroups = new Map(); // groupId -> Set(chart instances)
    this.chartToGroup = new Map(); // chart instance -> groupId
    this.currentHoverState = new Map(); // groupId -> { timestamp, value }
  }

  registerChart(chart, groupId, overlay) {
    if (!groupId) return;

    // Add to sync group
    if (!this.syncGroups.has(groupId)) {
      this.syncGroups.set(groupId, new Set());
    }
    this.syncGroups.get(groupId).add(chart);
    this.chartToGroup.set(chart, groupId);

    // Attach event listeners
    this._attachSyncListeners(chart, groupId, overlay);
  }

  unregisterChart(chart) {
    const groupId = this.chartToGroup.get(chart);
    if (!groupId) return;

    const group = this.syncGroups.get(groupId);
    if (group) {
      group.delete(chart);
      if (group.size === 0) {
        this.syncGroups.delete(groupId);
      }
    }

    this.chartToGroup.delete(chart);
  }

  _attachSyncListeners(chart, groupId, overlay) {
    const chartContainer = document.querySelector(`#apex-chart-${overlay.id}`);
    if (!chartContainer) return;

    // Mouse move for synchronized tooltips/crosshairs
    chartContainer.addEventListener('mousemove', (event) => {
      this._handleMouseMove(chart, groupId, event);
    });

    // Mouse leave
    chartContainer.addEventListener('mouseleave', () => {
      this._handleMouseLeave(chart, groupId);
    });

    // Zoom handler
    if (overlay.style?.enable_zoom) {
      chart.addEventListener('zoomed', (event) => {
        this._handleZoom(chart, groupId, event);
      });
    }
  }

  _handleMouseMove(sourceChart, groupId, event) {
    const group = this.syncGroups.get(groupId);
    if (!group || group.size <= 1) return;

    // Calculate chart data at mouse position
    const chartData = this._getChartDataAtPosition(sourceChart, event);
    if (!chartData) return;

    // Store hover state
    this.currentHoverState.set(groupId, chartData);

    // Propagate to other charts in group
    group.forEach(targetChart => {
      if (targetChart === sourceChart) return;
      this._showSyncedTooltip(targetChart, chartData);
    });
  }

  _handleMouseLeave(sourceChart, groupId) {
    const group = this.syncGroups.get(groupId);
    if (!group) return;

    // Clear hover state
    this.currentHoverState.delete(groupId);

    // Hide tooltips on all charts
    group.forEach(targetChart => {
      this._hideTooltip(targetChart);
    });
  }

  _handleZoom(sourceChart, groupId, event) {
    const group = this.syncGroups.get(groupId);
    if (!group || group.size <= 1) return;

    // Get zoom range from source chart
    const zoomRange = this._getZoomRange(sourceChart);
    if (!zoomRange) return;

    // Apply zoom to other charts
    group.forEach(targetChart => {
      if (targetChart === sourceChart) return;
      targetChart.zoomX(zoomRange.min, zoomRange.max);
    });
  }

  _getChartDataAtPosition(chart, event) {
    try {
      const w = chart.w; // ApexCharts window object
      if (!w) return null;

      const chartRect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - chartRect.left;

      // Convert pixel to data coordinates
      const dataX = w.globals.minX + (x / w.globals.gridWidth) * (w.globals.maxX - w.globals.minX);

      return {
        timestamp: dataX,
        x: x
      };
    } catch (error) {
      return null;
    }
  }

  _showSyncedTooltip(targetChart, chartData) {
    try {
      // Find closest data point
      const dataPointIndex = this._findClosestDataPointIndex(targetChart, chartData.timestamp);
      if (dataPointIndex === -1) return;

      // Show tooltip
      targetChart.showTooltip({
        seriesIndex: 0,
        dataPointIndex: dataPointIndex
      });

      // Draw crosshair
      this._drawCrosshair(targetChart, dataPointIndex);
    } catch (error) {
      // Silently fail
    }
  }

  _hideTooltip(chart) {
    try {
      chart.hideTooltip();
      this._hideCrosshair(chart);
    } catch (error) {
      // Silently fail
    }
  }

  _findClosestDataPointIndex(chart, targetTimestamp) {
    try {
      const w = chart.w;
      if (!w || !w.config.series || !w.config.series[0]) return -1;

      const seriesData = w.config.series[0].data;
      if (!seriesData || seriesData.length === 0) return -1;

      // Binary search for closest timestamp
      let closestIndex = 0;
      let closestDiff = Math.abs(seriesData[0].x - targetTimestamp);

      for (let i = 1; i < seriesData.length; i++) {
        const diff = Math.abs(seriesData[i].x - targetTimestamp);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIndex = i;
        }
      }

      return closestIndex;
    } catch (error) {
      return -1;
    }
  }

  _drawCrosshair(chart, dataPointIndex) {
    try {
      const w = chart.w;
      if (!w) return;

      const chartSvg = chart.el.querySelector('svg');
      if (!chartSvg) return;

      // Remove existing crosshair
      const existingCrosshair = chartSvg.querySelector('.msd-sync-crosshair');
      if (existingCrosshair) {
        existingCrosshair.remove();
      }

      // Calculate X position
      const xPos = w.globals.gridWidth * (dataPointIndex / (w.globals.series[0].length - 1));

      // Create crosshair line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'msd-sync-crosshair');
      line.setAttribute('x1', xPos + w.globals.translateX);
      line.setAttribute('y1', w.globals.translateY);
      line.setAttribute('x2', xPos + w.globals.translateX);
      line.setAttribute('y2', w.globals.translateY + w.globals.gridHeight);
      line.setAttribute('stroke', 'var(--lcars-orange)');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '4');
      line.setAttribute('opacity', '0.6');

      chartSvg.appendChild(line);
    } catch (error) {
      // Silently fail
    }
  }

  _hideCrosshair(chart) {
    try {
      const chartSvg = chart.el.querySelector('svg');
      if (!chartSvg) return;

      const crosshair = chartSvg.querySelector('.msd-sync-crosshair');
      if (crosshair) {
        crosshair.remove();
      }
    } catch (error) {
      // Silently fail
    }
  }

  _getZoomRange(chart) {
    try {
      const w = chart.w;
      if (!w) return null;

      return {
        min: w.globals.minX,
        max: w.globals.maxX
      };
    } catch (error) {
      return null;
    }
  }
}

// Global singleton
if (typeof window !== 'undefined') {
  if (!window.__msdChartSyncManager) {
    window.__msdChartSyncManager = new ChartSyncManager();
  }
}

export const chartSyncManager = window.__msdChartSyncManager || new ChartSyncManager();
```

### 5.4 Integration with ApexChartsOverlayRenderer

```javascript
// src/msd/renderer/ApexChartsOverlayRenderer.js (enhancement)

import { chartSyncManager } from '../charts/ChartSyncManager.js';

_scheduleChartCreation(containerId, series, options, overlay, dataSourceManager, svgContainer) {
  // ... existing creation logic

  const attemptCreation = () => {
    // ... existing container discovery

    try {
      const chart = new ApexCharts(container, {
        ...options,
        series
      });

      chart.render().then(() => {
        // ... existing logic

        // Store chart instance
        this.charts.set(overlay.id, chart);

        // ADDED: Register for syncing if sync_group specified
        const syncGroup = overlay.style?.sync_group;
        if (syncGroup) {
          chartSyncManager.registerChart(chart, syncGroup, overlay);
          cblcarsLog.debug(`[ApexChartsOverlayRenderer] Chart ${overlay.id} synced to group: ${syncGroup}`);
        }

        // Subscribe to DataSource updates
        this._subscribeToDataSource(sourceRef, dataSourceManager, chart, overlay);
      });

    } catch (error) {
      cblcarsLog.error(`[ApexChartsOverlayRenderer] Chart creation failed: ${overlay.id}`, error);
    }
  };

  setTimeout(attemptCreation, 100);
}

// Enhanced cleanup
static cleanup(overlayId) {
  const instance = ApexChartsOverlayRenderer._getInstance();
  
  const chart = instance.charts.get(overlayId);
  if (chart) {
    try {
      // ADDED: Unregister from sync manager
      chartSyncManager.unregisterChart(chart);

      chart.destroy();
      instance.charts.delete(overlayId);
    } catch (error) {
      cblcarsLog.error(`[ApexChartsOverlayRenderer] Error destroying chart ${overlayId}:`, error);
    }
  }

  // ... rest of cleanup
}
```

### 5.5 User-Facing YAML

```yaml
msd:
  overlays:
    # Temperature chart
    - id: temp_chart
      type: apexchart
      source: temperature
      position: [50, 100]
      size: [400, 150]
      style:
        chart_type: "line"
        color: "var(--lcars-blue)"
        sync_group: "climate"  # Sync group identifier

    # Humidity chart (synced with temperature)
    - id: humidity_chart
      type: apexchart
      source: humidity
      position: [50, 270]
      size: [400, 150]
      style:
        chart_type: "area"
        color: "var(--lcars-green)"
        sync_group: "climate"  # Same group = synced

    # Power chart (separate sync group)
    - id: power_chart
      type: apexchart
      source: power_meter
      position: [470, 100]
      size: [400, 150]
      style:
        chart_type: "line"
        color: "var(--lcars-yellow)"
        sync_group: "power"  # Different group
```

### 5.6 Synchronized Features

| Feature | Implementation | Status |
|---------|---------------|---------|
| **Synchronized tooltips** | Custom mouse tracking | ✅ Phase 1 |
| **Synchronized crosshairs** | SVG overlay | ✅ Phase 1 |
| **Synchronized zoom** | Zoom range propagation | ✅ Phase 2 |
| **Synchronized pan** | Complex, optional | ⚠️ Phase 3 |

### 5.7 Real-World Example

**Multi-Panel Climate Monitoring:**

```yaml
overlays:
  # Indoor temperature
  - id: indoor_temp
    type: apexchart
    source: indoor_temperature
    position: [50, 100]
    size: [300, 120]
    style:
      chart_type: "line"
      sync_group: "environment"
      enable_zoom: true

  # Outdoor temperature
  - id: outdoor_temp
    type: apexchart
    source: outdoor_temperature
    position: [370, 100]
    size: [300, 120]
    style:
      chart_type: "line"
      sync_group: "environment"

  # Humidity
  - id: humidity
    type: apexchart
    source: humidity_sensor
    position: [50, 240]
    size: [300, 120]
    style:
      chart_type: "area"
      sync_group: "environment"
```

**Behavior:**
- Hovering over any chart shows tooltips on all 3 charts at the same time
- Crosshair line appears on all charts simultaneously
- Zooming in one chart zooms all charts in the group
- Each chart can display different data types (temp vs humidity)

### 5.8 Implementation Effort

**Estimated Effort:**
- **Phase 1** (tooltips + crosshairs): 2-3 days
- **Phase 2** (zoom): 1 day
- **Phase 3** (pan, optional): 1 day
- **Testing**: 1 day
- **Documentation**: 1 day
- **Total**: ~1 week

### 5.9 Benefits

1. **LCARS Authenticity**: Multi-panel monitoring matches Engineering displays
2. **User Experience**: Coordinated interactions for better data analysis
3. **Shadow DOM Compatible**: Works in MSD's architecture
4. **Cross-Instance Support**: Syncs charts across multiple MSD cards
5. **Customizable**: Per-group configuration

---

## 6. Animation System Integration (Future)

### 6.1 Overview

**Status:** 🚧 **DEFERRED - Future Work**

**Context:** MSD has a partially-written animation system using Anime.js v4 that requires bridging work before ApexCharts can integrate with it.

### 6.2 Current Animation System

**Location:** `src/msd/animation/`

**Key Components:**
- AnimationRegistry
- Anime.js v4 integration
- Timeline support
- Scope-based animations

**Current Usage:** Primarily for MSD overlay animations (lines, text, etc.)

### 6.3 ApexCharts Animation Gaps

**ApexCharts Built-in Animations:**
- Chart render animations (built-in)
- Data update animations (built-in)
- Transitions (built-in)

**MSD Animation System:**
- Timeline-based sequences
- Coordinated multi-element animations
- LCARS-specific effects (sweeps, pulses, etc.)

**Gap:** No bridge between ApexCharts internal animations and MSD animation system.

### 6.4 Future Integration Opportunities

#### 6.4.1 Chart Entrance Animations

**Concept:** Coordinate ApexCharts entrance with other MSD overlays.

```yaml
# FUTURE CONCEPT (not implemented)
overlays:
  - id: temp_chart
    type: apexchart
    source: temperature
    position: [50, 100]
    size: [300, 150]
    animations:
      entrance:
        timeline: "dashboard_reveal"
        delay: 0.5
        duration: 1.0
```

#### 6.4.2 Data Update Choreography

**Concept:** Coordinate chart updates with visual effects.

```yaml
# FUTURE CONCEPT (not implemented)
overlays:
  - id: alert_chart
    type: apexchart
    source: alert_level
    position: [50, 100]
    size: [300, 150]
    animations:
      on_threshold:
        trigger: "above:90"
        effect: "pulse_red"
        duration: 2.0
```

#### 6.4.3 Timeline Integration

**Concept:** Charts as part of larger animation sequences.

```yaml
# FUTURE CONCEPT (not implemented)
timelines:
  - id: diagnostic_sequence
    steps:
      - animate: "diagnostic_label"
        effect: "fade_in"
        duration: 0.5
      - animate: "diagnostic_chart"
        effect: "chart_reveal"
        duration: 1.0
      - animate: "diagnostic_results"
        effect: "cascade_in"
        duration: 0.8
```

### 6.5 Required Bridging Work

**Before ApexCharts can integrate with animation system:**

1. **Anime.js v4 API Wrapper**
   - Consistent interface for all animated elements
   - Chart-specific animation hooks

2. **Timeline Event System**
   - Charts need to emit timeline-compatible events
   - Coordinate with other overlay animations

3. **Scope Management**
   - Charts must respect Anime.js Scope boundaries
   - Shadow DOM + foreignObject compatibility

4. **Performance Considerations**
   - Throttling/debouncing for chart updates
   - Animation budget management

### 6.6 Implementation Strategy (Future)

**Phase 1: Foundation**
- Complete Anime.js v4 wrapper for MSD
- Document animation API
- Test with existing overlays

**Phase 2: Chart Hooks**
- Add animation lifecycle hooks to ApexChartsOverlayRenderer
- Implement basic entrance/exit animations
- Test coordination with text/line overlays

**Phase 3: Timeline Integration**
- Bridge ApexCharts events to MSD timeline system
- Implement data-driven animations
- Test complex sequences

**Phase 4: LCARS Effects**
- Custom LCARS-specific chart animations
- Alert/threshold-triggered effects
- Polish and performance optimization

### 6.7 Documentation Note

**For this proposal:** Animation integration is **OUT OF SCOPE**.

**Reason:** Animation system requires foundational work before chart integration can be designed.

**Action:** Create separate proposal/issue for animation integration after:
1. Anime.js v4 wrapper is complete
2. Animation API is documented
3. Timeline system is tested with existing overlays

---

## 7. Implementation Roadmap

### 7.1 Phase Overview

**Total Duration:** 3-4 weeks  
**Resources:** 1-2 developers

### 7.2 Phase 1: Foundation (Week 1)

**Focus:** Core systems implementation

#### Tasks

1. **ChartTemplateRegistry** (2 days)
   - [ ] Create `src/msd/templates/ChartTemplateRegistry.js`
   - [ ] Implement template registration and retrieval
   - [ ] Add deep merge logic
   - [ ] Write unit tests

2. **ThemeSystem** (2 days)
   - [ ] Create `src/msd/themes/ThemeSystem.js`
   - [ ] Implement theme registration and application
   - [ ] Add palette CSS variable application
   - [ ] Test theme switching

3. **Pack Integration** (1 day)
   - [ ] Update `loadBuiltinPacks.js` with templates and themes
   - [ ] Modify `PackManager.js` to load new features
   - [ ] Test pack loading sequence

**Deliverables:**
- ✅ ChartTemplateRegistry functional
- ✅ ThemeSystem functional
- ✅ Built-in templates (6) registered
- ✅ Built-in themes (4) registered

### 7.3 Phase 2: Integration (Week 2)

**Focus:** Integrate new systems with existing code

#### Tasks

1. **ApexChartsAdapter Enhancement** (2 days)
   - [ ] Integrate ThemeSystem into `generateOptions()`
   - [ ] Add `_applyChartTheme()` method
   - [ ] Update option precedence logic
   - [ ] Test theme application

2. **Overlay Processing** (1 day)
   - [ ] Update overlay processor to apply templates
   - [ ] Test template merging
   - [ ] Verify precedence rules

3. **Additional Chart Types** (2 days)
   - [ ] Update validation to include all 15 types
   - [ ] Add chart-type-specific defaults
   - [ ] Create examples for each type
   - [ ] Test rendering

**Deliverables:**
- ✅ Themes applied to charts
- ✅ Templates applied to overlays
- ✅ 15 chart types supported
- ✅ LCARS-optimized defaults

### 7.4 Phase 3: Chart Synchronization (Week 3)

**Focus:** Implement custom sync system

#### Tasks

1. **ChartSyncManager** (3 days)
   - [ ] Create `src/msd/charts/ChartSyncManager.js`
   - [ ] Implement tooltip synchronization
   - [ ] Implement crosshair rendering
   - [ ] Test with 2-3 synced charts

2. **ApexChartsOverlayRenderer Integration** (1 day)
   - [ ] Add sync registration in `_scheduleChartCreation()`
   - [ ] Update cleanup to unregister from sync
   - [ ] Test lifecycle

3. **Advanced Sync Features** (1 day)
   - [ ] Implement zoom synchronization
   - [ ] (Optional) Implement pan synchronization
   - [ ] Test edge cases

**Deliverables:**
- ✅ ChartSyncManager functional
- ✅ Tooltip sync working
- ✅ Crosshair sync working
- ✅ Zoom sync working

### 7.5 Phase 4: Documentation & Polish (Week 4)

**Focus:** Documentation, examples, and testing

#### Tasks

1. **User Documentation** (2 days)
   - [ ] Document chart templates
   - [ ] Document theme system
   - [ ] Document all 15 chart types
   - [ ] Document chart synchronization
   - [ ] Create comprehensive examples

2. **Developer Documentation** (1 day)
   - [ ] Document ChartTemplateRegistry API
   - [ ] Document ThemeSystem API
   - [ ] Document ChartSyncManager API
   - [ ] Add architecture diagrams

3. **Testing & Examples** (2 days)
   - [ ] Create example pack with custom templates/themes
   - [ ] Create demo dashboards
   - [ ] Performance testing
   - [ ] Edge case testing

**Deliverables:**
- ✅ Complete user documentation
- ✅ Complete developer documentation
- ✅ Example configurations
- ✅ Demo dashboards

### 7.6 Milestone Checklist

#### Milestone 1: Foundation Complete
- [ ] ChartTemplateRegistry implemented
- [ ] ThemeSystem implemented
- [ ] Pack system updated
- [ ] Unit tests passing

#### Milestone 2: Integration Complete
- [ ] Themes apply to charts
- [ ] Templates apply to overlays
- [ ] All 15 chart types render correctly
- [ ] Integration tests passing

#### Milestone 3: Synchronization Complete
- [ ] ChartSyncManager implemented
- [ ] Tooltip/crosshair sync working
- [ ] Zoom sync working
- [ ] Sync tests passing

#### Milestone 4: Production Ready
- [ ] All documentation complete
- [ ] Examples published
- [ ] Performance validated
- [ ] Code review complete
- [ ] Ready for release

---

## 8. Technical Architecture

### 8.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     MSD ApexCharts System                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐   ┌──────────────────┐                   │
│  │ ChartTemplate    │   │   ThemeSystem    │                   │
│  │   Registry       │   │                  │                   │
│  │                  │   │  ┌────────────┐  │                   │
│  │ - register()     │   │  │ Palettes   │  │                   │
│  │ - get()          │   │  │ (Colors)   │  │                   │
│  │ - apply()        │   │  └────────────┘  │                   │
│  │ - listTemplates()│   │  ┌────────────┐  │                   │
│  └────────┬─────────┘   │  │ChartThemes │  │                   │
│           │             │  │ (Styling)  │  │                   │
│           │             │  └────────────┘  │                   │
│           │             │                  │                   │
│           │             │ - register()     │                   │
│           │             │ - apply()        │                   │
│           │             │ - getChartTheme()│                   │
│           │             └──────────┬───────┘                   │
│           │                        │                           │
│           │                        │                           │
│           ▼                        ▼                           │
│  ┌─────────────────────────────────────────┐                   │
│  │     ApexChartsAdapter                   │                   │
│  │                                          │                   │
│  │  convertToSeries()                      │                   │
│  │  generateOptions()                      │                   │
│  │    ├─ Apply Theme                       │                   │
│  │    ├─ Apply Template                    │                   │
│  │    ├─ Apply MSD Style                   │                   │
│  │    └─ Apply chart_options               │                   │
│  │                                          │