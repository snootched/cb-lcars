# MSD Validation Guide - User Documentation

**Location:** `/doc/user/validation_guide.md`

## Table of Contents
1. [What is Validation?](#what-is-validation)
2. [How to Check for Errors](#how-to-check-for-errors)
3. [Understanding Error Messages](#understanding-error-messages)
4. [Common Errors and Fixes](#common-errors-and-fixes)
5. [Chart Validation](#chart-validation)
6. [Troubleshooting](#troubleshooting)

---

## What is Validation?

The MSD validation system checks your overlay configuration for errors **before** rendering. This helps you:

- **Catch typos and mistakes early**
- **Get helpful error messages** with suggestions
- **Understand why overlays aren't working**
- **Fix configuration issues quickly**

Validation runs automatically when your MSD loads and can also be triggered manually from the browser console.

---

## How to Check for Errors

### In Browser Console

Open your browser's developer console (F12) and run:

```javascript
// Check all overlays
__msdDebug.charts.validateAll()

// Check a specific overlay
__msdDebug.charts.validate('my-overlay-id')

// See validation results
__msdDebug.pipelineInstance.config.__validation
```

### Understanding Results

```javascript
{
  "total": 10,      // Total number of overlays
  "valid": 8,       // Overlays with no errors
  "invalid": 2,     // Overlays with errors
  "errors": 3,      // Total error count
  "warnings": 5     // Total warning count
}
```

- **Errors** (🔴) - Must be fixed for overlay to work correctly
- **Warnings** (⚠️) - Should be reviewed but won't break functionality

---

## Understanding Error Messages

### Error Structure

```javascript
{
  "field": "source",
  "type": "required_field",
  "message": "ApexChart overlay requires a data source",
  "severity": "error",
  "suggestion": "Add a 'source', 'data_source', or 'sources' field"
}
```

- **field** - Which configuration field has the problem
- **type** - What kind of error it is
- **message** - Human-readable description
- **suggestion** - How to fix it

### Common Error Types

| Type | Meaning | Example |
|------|---------|---------|
| `required_field` | Required field is missing | Missing `text` in text overlay |
| `invalid_type` | Wrong data type | Using string where number expected |
| `invalid_format` | Wrong format | Invalid color code |
| `invalid_reference` | Reference doesn't exist | Attachment to non-existent overlay |
| `incompatible_data_format` | Chart data format mismatch | rangeArea chart with single-value data |

---

## Common Errors and Fixes

### 1. Missing Required Field

**Error:**
```
Required field "text" is missing
```

**Fix:**
```yaml
# Before (error):
- id: my-text
  type: text
  position: [100, 100]

# After (fixed):
- id: my-text
  type: text
  position: [100, 100]
  text: "My Label"  # ✅ Added required field
```

**Note:** Text overlays can use either `text` OR `content` field.

---

### 2. Invalid Color Format

**Error:**
```
Field "style.color" has invalid color format
```

**Fix:**
```yaml
# Acceptable color formats:
style:
  color: "#ff0000"              # ✅ Hex
  color: "rgb(255, 0, 0)"       # ✅ RGB
  color: "rgba(255, 0, 0, 0.5)" # ✅ RGBA
  color: "var(--my-color)"      # ✅ CSS variable
  color: "colors.primary"       # ✅ Design token

  color: "red!"                 # ❌ Invalid
```

---

### 3. Wrong Data Type

**Error:**
```
Field "font_size" has invalid type
Expected: number
Actual: string
```

**Fix:**
```yaml
# Before (error):
style:
  font_size: "24"  # ❌ String

# After (fixed):
style:
  font_size: 24    # ✅ Number
```

**Note:** Some fields accept **enhanced formats**:
```yaml
# Also valid (enhanced format):
style:
  font_size:
    value: 28
    scale: "viewbox"
    unit: "px"
```

---

### 4. Missing Attachment Target

**Error:**
```
Target overlay "my-anchor" not found
```

**Fix:**
```yaml
# Option 1: Remove attachment
- id: my-line
  type: line
  # attach_to: "my-anchor"  # ❌ Removed
  points: [[100, 100], [200, 200]]

# Option 2: Create the target
- id: my-anchor
  type: anchor
  position: [150, 150]

- id: my-line
  type: line
  attach_to: "my-anchor"  # ✅ Now exists
```

---

### 5. Invalid Data Source Reference

**Error:**
```
Data source "temperature_sensor" not found
```

**Fix:**
```yaml
# Check your data_sources section:
data_sources:
  temperature:  # ← Actual name
    entity: sensor.outside_temp

overlays:
  - id: temp-chart
    type: apexchart
    source: "temperature"  # ✅ Match data source name
```

---

### 6. Design Token Not Resolving

**Warning:**
```
Token "typography.fontSize.2xl" exists but failed to resolve
```

**What it means:** The token exists in your theme but couldn't be converted to a value (might have circular references or invalid value).

**Fix:**
Check your theme configuration:
```yaml
theme:
  typography:
    fontSize:
      2xl: 28  # ✅ Should be a valid number
      # 2xl: "typography.fontSize.xl"  # ❌ Circular reference
```

---

## Chart Validation

### Chart Data Format Errors

Charts require specific data formats depending on chart type.

#### rangeArea Chart

**Error:**
```
Chart type 'rangeArea' requires range data [min, max],
but source provides single values
```

**What it means:** rangeArea charts need data with min/max arrays, like:
```javascript
[
  { x: timestamp1, y: [22.0, 28.0] },
  { x: timestamp2, y: [23.5, 27.5] }
]
```

**Fix:**
```yaml
# Option 1: Change chart type (temporary)
chart_type: line  # Works with single values

# Option 2: Use rolling_statistics transformation (when available)
data_sources:
  temperature:
    entity: sensor.outside_temp
    transformations:
      - type: rolling_statistics
        key: range
        window_size: 20
        stats: [min, max]

overlays:
  - id: temp-range-chart
    type: apexchart
    chart_type: rangeArea
    source: "temperature.transformations.range"
```

### Check Chart Compatibility

```javascript
// See what format a chart type needs
__msdDebug.charts.getFormatSpec('rangeArea')

// Check if your data source works with the chart
__msdDebug.charts.checkCompatibility('my-chart-overlay')

// List all supported chart types
__msdDebug.charts.listTypes()
```

---

## Troubleshooting

### My overlay isn't showing up

1. **Check validation errors:**
   ```javascript
   __msdDebug.charts.validate('my-overlay-id')
   ```

2. **Check if overlay exists:**
   ```javascript
   __msdDebug.pipelineInstance.getResolvedModel().overlays
   ```

3. **Check console for errors:**
   - Open browser console (F12)
   - Look for red error messages

### Validation says it's valid but overlay still doesn't work

Validation only checks **configuration structure**. It doesn't check:
- If data sources have data
- If animations are correct
- If styles render properly
- Runtime JavaScript errors

Check the browser console for runtime errors.

### Too many warnings!

Warnings don't break functionality. Common warnings:
- **Token resolution failed** - Token exists but has issues (check theme)
- **Unknown data source path** - Path might be valid but not recognized
- **Conflicting fields** - Multiple ways to specify same thing (choose one)

You can usually ignore warnings if everything works.

### How do I disable validation?

Validation is lightweight and helpful - we recommend leaving it enabled. However, you can:

```javascript
// Disable token validation
validationService.config.validateTokens = false;

// Disable data source validation
validationService.config.validateDataSources = false;
```

---

## Quick Reference

### Debug Commands

```javascript
// Validation
__msdDebug.charts.validateAll()
__msdDebug.charts.validate('overlay-id')

// Chart validation
__msdDebug.charts.getFormatSpec('rangeArea')
__msdDebug.charts.listTypes()
__msdDebug.charts.checkCompatibility('chart-id')

// Results
__msdDebug.pipelineInstance.config.__validation
```

### Required Fields by Overlay Type

| Overlay Type | Required Fields |
|-------------|----------------|
| `text` | `position`, `text` OR `content` |
| `line` | `points` (unless using `attach_to`) |
| `button` | `position`, `size` |
| `apexchart` | `position`, `size`, data source (`source`/`data_source`/`sources`) |
| `status_grid` | `position`, `size`, `cells` |

### Accepted Data Types

| Field | Type | Examples |
|-------|------|----------|
| `position` | Array OR string | `[100, 200]` or `"my-anchor"` |
| `size` | Array | `[300, 400]` |
| `color` | String | `"#ff0000"`, `"rgb(255,0,0)"`, `"colors.primary"` |
| `font_size` | Number OR Object | `24` or `{ value: 28, scale: "viewbox" }` |
| `source` | String OR Array | `"temperature"` or `["temp1", "temp2"]` |

---

## Need More Help?

- [Architecture Documentation](/doc/architecture/validation_architecture.md) - For developers
- [Troubleshooting Guide](/doc/user/validation_troubleshooting.md) - Common issues
- [GitHub Issues](https://github.com/snootched/cb-lcars-copilot/issues) - Report bugs
- [Discussions](https://github.com/snootched/cb-lcars-copilot/discussions) - Ask questions

---

*Last Updated: 2025-01-19*
*Version: 1.0*