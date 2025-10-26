# ApexCharts Color Support Analysis
**Date:** 2025-10-24
**Purpose:** Compare CB-LCARS validation schema vs ApexChartsAdapter vs ApexCharts official API

---

## Official ApexCharts Color API

Source: https://apexcharts.com/docs/colors/

### 1. **Series Colors** (`colors` array)
```javascript
colors: ['#FF0000', '#00FF00', '#0000FF']
```
- **Purpose:** Colors for chart series (lines, bars, pie slices, etc.)
- **Scope:** Data series
- **Default:** ApexCharts built-in palette

### 2. **Fill Colors** (`fill.colors`)
```javascript
fill: {
  colors: ['#FF0000', '#00FF00'],
  type: 'solid' | 'gradient' | 'pattern' | 'image'
}
```
- **Purpose:** Fill colors for areas, bars, pies
- **Scope:** Chart fills (usually inherits from `colors` if not specified)

### 3. **Stroke Colors** (`stroke.colors`)
```javascript
stroke: {
  colors: ['#FFFFFF'],  // Border/outline colors
  width: 2
}
```
- **Purpose:** Border/outline colors for chart elements
- **Scope:** Lines, borders, outlines
- **Note:** Different from series colors!

### 4. **Grid Colors** (`grid.borderColor`)
```javascript
grid: {
  borderColor: '#999999',
  row: { colors: ['#f3f3f3', 'transparent'] },  // Alternating row colors
  column: { colors: ['#f3f3f3', 'transparent'] }  // Alternating column colors
}
```
- **Purpose:** Grid line and background colors
- **Scope:** Chart grid

### 5. **Axis Colors** (`xaxis.labels.style.colors`, `yaxis.labels.style.colors`)
```javascript
xaxis: {
  labels: {
    style: {
      colors: '#999999'  // Single color OR array for each label
    }
  },
  axisBorder: { color: '#999999' },
  axisTicks: { color: '#999999' }
}
```
- **Purpose:** Axis label, border, tick colors
- **Scope:** X/Y axis elements
- **Note:** Can be single color OR array (one per label)

### 6. **Legend Colors** (`legend.labels.colors`)
```javascript
legend: {
  labels: {
    colors: '#FFFFFF'  // Single color OR array
  }
}
```
- **Purpose:** Legend text color
- **Scope:** Legend labels

### 7. **Tooltip Colors** (`tooltip.theme`, custom CSS)
```javascript
tooltip: {
  theme: 'dark' | 'light',  // Predefined themes
  style: {
    fontSize: '12px',
    // No direct color property - uses theme
  },
  custom: function({ series, seriesIndex, dataPointIndex, w }) {
    return '<div class="custom-tooltip">...</div>'  // Full control
  }
}
```
- **Purpose:** Tooltip styling
- **Scope:** Tooltip appearance
- **Note:** Limited direct color control (use theme or custom renderer)

### 8. **Data Labels Colors** (`dataLabels.style.colors`)
```javascript
dataLabels: {
  enabled: true,
  style: {
    colors: ['#FFFFFF']
  }
}
```
- **Purpose:** Colors for data value labels on chart
- **Scope:** In-chart value labels

### 9. **Marker Colors** (`markers.colors`, `markers.strokeColors`)
```javascript
markers: {
  colors: ['#FF0000'],      // Fill color
  strokeColors: '#FFFFFF',   // Border color
  strokeWidth: 2
}
```
- **Purpose:** Point marker styling
- **Scope:** Data point markers

### 10. **Theme Colors** (`theme.palette`)
```javascript
theme: {
  mode: 'dark' | 'light',
  palette: 'palette1' | 'palette2' | ... | 'palette10',  // Predefined palettes
  monochrome: {
    enabled: true,
    color: '#FF0000',
    shadeTo: 'light' | 'dark',
    shadeIntensity: 0.65
  }
}
```
- **Purpose:** Global color theming
- **Scope:** Entire chart
- **Note:** Powerful but opinionated

---

## CB-LCARS Current Support

### Validation Schema (`apexChartOverlay.js`)

**CURRENTLY VALIDATED:**
```javascript
style: {
  background_color: { type: 'string', format: 'color' },  // ✅ Supported
  stroke_color: { type: 'string', format: 'color' },      // ✅ Supported
  stroke_width: { type: 'number', min: 0, max: 20 },      // ✅ Supported
  grid_color: { type: 'string', format: 'color' },        // ✅ Supported
  colors: { type: 'array', items: { format: 'color' } },  // ✅ Supported (series colors)

  // Boolean flags
  show_grid: { type: 'boolean' },
  show_legend: { type: 'boolean' },
  show_toolbar: { type: 'boolean' },
  show_tooltip: { type: 'boolean' },

  // Other
  time_window: { type: 'string', pattern: /^\d+[smhd]$/ },
  max_points: { type: 'number', min: 10, max: 10000 },
  animation_preset: { type: 'string' },
  chart_options: { type: 'object' }  // ⚠️ Escape hatch - NO VALIDATION
}
```

**NOT VALIDATED:**
- ❌ `fill.colors` (area/bar fill colors)
- ❌ `stroke.colors` (specific stroke color array - we only support `stroke_color`)
- ❌ `grid.row.colors` / `grid.column.colors` (alternating grid colors)
- ❌ `xaxis.labels.style.colors` (axis label color arrays)
- ❌ `yaxis.labels.style.colors`
- ❌ `legend.labels.colors`
- ❌ `dataLabels.style.colors`
- ❌ `markers.colors` / `markers.strokeColors`
- ❌ `theme.palette` / `theme.monochrome`

---

## ApexChartsAdapter Current Implementation

**WHAT ADAPTER MAPS:**

```javascript
// ✅ Series colors (PRIMARY COLOR CONTROL)
colors: style.colors || style.color
// Converts single string → array
// Falls back to token: resolveToken('defaultColors')

// ✅ Stroke colors (but hardcoded logic)
stroke: {
  width: strokeWidth,
  colors: style.stroke_colors || [strokeColor]  // ⚠️ Uses stroke_color as fallback
}

// ✅ Grid color
grid: {
  borderColor: gridColor  // From style.grid_color or token
}

// ✅ Axis colors (derived from stroke_color)
xaxis: { labels: { style: { colors: axisColor } } }  // axisColor = strokeColor
yaxis: { labels: { style: { colors: axisColor } } }

// ✅ Legend color (from token)
legend: {
  labels: { colors: legendColor }  // From token: 'colors.ui.foreground'
}

// ✅ Background
chart: { background: backgroundColor }

// ✅ Foreground (text color)
chart: { foreColor: strokeColor }
```

**WHAT'S MISSING:**
- ❌ No mapping for `fill.colors` (area/bar fills)
- ❌ No mapping for `markers.colors`
- ❌ No mapping for `dataLabels.style.colors`
- ❌ No control over `theme.palette` or `theme.monochrome`
- ⚠️ `stroke.colors` hardcoded fallback logic (not flexible)

---

## The Problem

### Issue 1: **Single Color (`color`) Not Properly Supported**

**User tries:**
```yaml
style:
  color: var(--picard-orange)  # Single color
```

**What happens:**
```javascript
// In ApexChartsAdapter
let colors = style.colors || style.color;  // ✅ Gets 'var(--picard-orange)'

if (typeof colors === 'string') {
  colors = [colors];  // ✅ Converts to array: ['var(--picard-orange)']
}

// ✅ Passed to ApexCharts
colors: ['var(--picard-orange)']
```

**BUT:**
- ⚠️ Validation schema **does NOT include `color` property** (only `colors` array)
- ⚠️ Rule patches use `color` (singular) not `colors` (plural)
- ⚠️ So validation may reject or ignore it!

### Issue 2: **CSS Variable Resolution**

**User tries:**
```yaml
style:
  color: var(--picard-orange)
```

**Potential issues:**
1. CSS variable may not be resolved in JavaScript context
2. ApexCharts may not support CSS variables (it's a canvas library)
3. Need to resolve CSS variables to actual hex/rgb values BEFORE passing to ApexCharts

### Issue 3: **Stroke vs Series Colors Confusion**

**ApexCharts has TWO different color concepts:**

1. **Series colors** (`colors`) → Color of the data (line/bar/pie)
2. **Stroke colors** (`stroke.colors`) → Color of the outline/border

**CB-LCARS conflates these:**
```javascript
stroke: {
  colors: style.stroke_colors || [strokeColor]  // Fallback to wrong color type!
}
```

**Result:** Changing `color` might not affect stroke, or vice versa

---

## Recommendations

### 1. **Expand Validation Schema**

```javascript
// Add to apexChartOverlay.js schema
style: {
  // PRIMARY CONTROL: Series colors
  color: {  // ✅ ADD: Single color support
    type: 'string',
    format: 'color',
    optional: true,
    errorMessage: 'Color must be a valid color value (will apply to all series)'
  },

  colors: {  // ✅ EXISTING: Multi-series colors
    type: 'array',
    optional: true,
    items: { type: 'string', format: 'color' }
  },

  // STROKE/OUTLINE CONTROL
  stroke_colors: {  // ✅ ADD: Specific stroke colors
    type: 'array',
    optional: true,
    items: { type: 'string', format: 'color' },
    errorMessage: 'Stroke colors must be an array of valid color values'
  },

  // FILL CONTROL (for area/bar charts)
  fill_colors: {  // ✅ ADD: Fill colors
    type: 'array',
    optional: true,
    items: { type: 'string', format: 'color' }
  },

  fill_type: {  // ✅ ADD: Fill type
    type: 'string',
    enum: ['solid', 'gradient', 'pattern'],
    optional: true
  },

  // AXIS COLORS
  axis_color: {  // ✅ ADD: Unified axis color
    type: 'string',
    format: 'color',
    optional: true
  },

  xaxis_color: {  // ✅ ADD: X-axis specific
    type: 'string',
    format: 'color',
    optional: true
  },

  yaxis_color: {  // ✅ ADD: Y-axis specific
    type: 'string',
    format: 'color',
    optional: true
  },

  // LEGEND COLORS
  legend_color: {  // ✅ ADD: Legend text color
    type: 'string',
    format: 'color',
    optional: true
  },

  // MARKER COLORS
  marker_colors: {  // ✅ ADD: Point marker colors
    type: 'array',
    optional: true,
    items: { type: 'string', format: 'color' }
  },

  marker_stroke_colors: {  // ✅ ADD: Marker border colors
    type: 'array',
    optional: true,
    items: { type: 'string', format: 'color' }
  },

  // DATA LABEL COLORS
  data_label_colors: {  // ✅ ADD: Value label colors
    type: 'array',
    optional: true,
    items: { type: 'string', format: 'color' }
  },

  // THEME CONTROL
  theme_palette: {  // ✅ ADD: Predefined palette
    type: 'string',
    enum: ['palette1', 'palette2', 'palette3', 'palette4', 'palette5',
           'palette6', 'palette7', 'palette8', 'palette9', 'palette10'],
    optional: true
  },

  theme_mode: {  // ✅ ADD: Dark/light mode
    type: 'string',
    enum: ['dark', 'light'],
    optional: true
  },

  monochrome: {  // ✅ ADD: Monochrome theme
    type: 'object',
    optional: true,
    properties: {
      enabled: { type: 'boolean' },
      color: { type: 'string', format: 'color' },
      shade_to: { type: 'string', enum: ['light', 'dark'] },
      shade_intensity: { type: 'number', min: 0, max: 1 }
    }
  }
}
```

### 2. **Fix ApexChartsAdapter Mapping**

```javascript
// In generateOptions()

// ✅ PRIMARY: Series colors (with fallback chain)
let colors = style.colors || (style.color ? [style.color] : null);
if (!colors && resolveToken) {
  colors = resolveToken('defaultColors', null, context);
}
// Resolve CSS variables HERE (before passing to ApexCharts)
if (Array.isArray(colors)) {
  colors = colors.map(color => this._resolveCssVariable(color));
}

// ✅ STROKE: Separate stroke colors (don't mix with series colors!)
let strokeColors = style.stroke_colors;
if (!strokeColors && style.stroke_color) {
  strokeColors = [style.stroke_color];
}
// Resolve CSS variables
if (strokeColors) {
  strokeColors = strokeColors.map(color => this._resolveCssVariable(color));
}

// ✅ FILL: Area/bar fill colors
const fillColors = style.fill_colors ?
  style.fill_colors.map(color => this._resolveCssVariable(color)) :
  undefined;

// ✅ MARKERS
const markerColors = style.marker_colors?.map(c => this._resolveCssVariable(c));
const markerStrokeColors = style.marker_stroke_colors?.map(c => this._resolveCssVariable(c));

// Build options
return {
  colors: colors,  // Series colors

  stroke: {
    width: strokeWidth,
    colors: strokeColors,  // Stroke-specific colors (not series colors!)
    curve: style.curve || 'smooth'
  },

  fill: {
    colors: fillColors,
    type: style.fill_type || 'solid'
  },

  markers: {
    colors: markerColors,
    strokeColors: markerStrokeColors
  },

  xaxis: {
    labels: {
      style: {
        colors: style.xaxis_color || style.axis_color || axisColor
      }
    }
  },

  yaxis: {
    labels: {
      style: {
        colors: style.yaxis_color || style.axis_color || axisColor
      }
    }
  },

  legend: {
    labels: {
      colors: style.legend_color || legendColor
    }
  },

  dataLabels: {
    style: {
      colors: style.data_label_colors
    }
  },

  theme: {
    mode: style.theme_mode,
    palette: style.theme_palette,
    monochrome: style.monochrome
  }
};
```

### 3. **Add CSS Variable Resolution**

```javascript
// New helper method in ApexChartsAdapter
static _resolveCssVariable(colorValue) {
  if (!colorValue || typeof colorValue !== 'string') {
    return colorValue;
  }

  // Check if it's a CSS variable
  if (colorValue.startsWith('var(')) {
    try {
      // Get computed style from document root
      const root = document.documentElement;
      const computed = getComputedStyle(root).getPropertyValue(
        colorValue.match(/var\((--[^,)]+)/)?.[1] || ''
      ).trim();

      if (computed) {
        cblcarsLog.debug(`[ApexChartsAdapter] Resolved CSS variable: ${colorValue} → ${computed}`);
        return computed;
      }
    } catch (error) {
      cblcarsLog.warn(`[ApexChartsAdapter] Failed to resolve CSS variable: ${colorValue}`, error);
    }
  }

  return colorValue;
}
```

---

## Priority Actions

### **IMMEDIATE (Fix Current Bug):**
1. ✅ Add `color` (singular) to validation schema
2. ✅ Add CSS variable resolution to ApexChartsAdapter
3. ✅ Fix `stroke.colors` fallback logic
4. ✅ Test with `color: var(--picard-orange)` in rules

### **SHORT TERM (Complete Color Support):**
1. Add `stroke_colors`, `fill_colors`, `marker_colors` to validation
2. Map these properly in ApexChartsAdapter
3. Add `axis_color`, `legend_color` controls
4. Document color properties for users

### **LONG TERM (Advanced Features):**
1. Theme palette support (`theme_palette`)
2. Monochrome mode support
3. Data label color control
4. Gradient/pattern fills

---

## Test Cases

### Test 1: Single Color (Rules Patch)
```yaml
rules:
  - when: { entity: light.tv, state: "on" }
    apply:
      overlays:
        - id: temp_apex_chart
          style:
            color: var(--picard-orange)  # Should work!
```

### Test 2: Multi-Series Colors
```yaml
overlays:
  - id: multi_chart
    type: apexchart
    sources: [temp1, temp2, temp3]
    style:
      colors:  # Array for multiple series
        - var(--lcars-blue)
        - var(--lcars-orange)
        - var(--lcars-red)
```

### Test 3: Stroke vs Fill
```yaml
style:
  colors:  # Series fill colors
    - var(--lcars-blue)
  stroke_colors:  # Border/outline colors (different!)
    - var(--lcars-white)
  stroke_width: 2
```

---

## Summary

**Root Causes:**
1. ❌ Validation schema missing `color` (singular) property
2. ❌ CSS variables not resolved before passing to ApexCharts
3. ⚠️ Incomplete color API support (only basic colors mapped)
4. ⚠️ Confusion between series colors vs stroke colors

**Fix Priority:**
1. **HIGH**: Add `color` to validation, resolve CSS variables
2. **MEDIUM**: Expand color API support (stroke_colors, fill_colors, etc.)
3. **LOW**: Theme/palette support

**Your instinct was RIGHT** - we need to align our validation schema with what ApexCharts actually supports!
