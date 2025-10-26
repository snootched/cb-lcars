# Overlay Architecture - Data Structures & Flow

**Date:** 2025-10-25
**Status:** 📖 REFERENCE DOCUMENTATION
**Related:** INCREMENTAL_UPDATE_IMPLEMENTATION.md, SMART_FALLBACK_COMPLETE.md

## Overview

This document details the structure of overlay objects and how data flows through the overlay rendering pipeline. Understanding these structures is critical for implementing incremental updates, selective re-renders, and debugging rendering issues.

---

## Table of Contents

1. [Overlay Object Structure](#overlay-object-structure)
2. [Overlay Lifecycle States](#overlay-lifecycle-states)
3. [Data Flow Through Pipeline](#data-flow-through-pipeline)
4. [Style Resolution Hierarchy](#style-resolution-hierarchy)
5. [Patch Objects](#patch-objects)
6. [Context Objects](#context-objects)
7. [Render Result Objects](#render-result-objects)
8. [Common Pitfalls & Best Practices](#common-pitfalls--best-practices)

---

## Overlay Object Structure

### Base Overlay Object (Configuration)

The overlay object starts as user configuration from YAML/JSON:

```javascript
{
  // Identity & Type
  id: string,                    // Unique identifier (e.g., "test_button1")
  type: string,                  // Overlay type (e.g., "button", "text", "status_grid")

  // Position & Size
  position: [number, number] | string,  // [x, y] or anchor reference
  size: [number, number],        // [width, height] - optional, type-specific defaults

  // Visual Styles (Base Configuration)
  style: {                       // Original user-defined styles
    color: string,               // CSS color or var() reference
    opacity: number,             // 0-1
    border: {                    // Border configuration (nested format)
      width: number,             // Uniform width
      color: string,             // Uniform color
      radius: number,            // Uniform radius (all corners)
      radius_top_left: number,   // Individual corner radii
      radius_top_right: number,
      radius_bottom_right: number,
      radius_bottom_left: number,
      top: {                     // Individual border sides
        width: number,
        color: string
      },
      right: { width, color },
      bottom: { width, color },
      left: { width, color }
    },
    label_color: string,
    value_color: string,
    // ... type-specific style properties
  },

  // Content
  label: string,                 // Display label
  content: string,               // Display content/value
  texts: Array<TextConfig>,      // Advanced text configurations

  // Actions
  tap_action: ActionConfig,      // Single tap action
  hold_action: ActionConfig,     // Long press action
  double_tap_action: ActionConfig, // Double tap action

  // Data Source
  data_source: string,           // Reference to data source ID

  // State Rules
  state_rules: Array<RuleConfig>, // Array of conditional rules

  // Internal Properties (added during processing)
  _raw: Object,                  // Original raw configuration
  _resolved: boolean,            // Whether overlay has been fully resolved
}
```

### Enhanced Overlay Object (During Pipeline)

As the overlay moves through the pipeline, additional properties are added:

```javascript
{
  ...baseOverlay,                // All base properties

  // Resolved Styles (Added by ModelBuilder)
  finalStyle: {                  // Merged style with rules applied
    ...style,                    // Base style properties
    ...patchedProperties         // Properties modified by matching rules
  },

  // Computed Properties (Added by various stages)
  resolvedPosition: [number, number],  // Computed absolute position
  boundingBox: {                 // Computed bounding box
    x: number,
    y: number,
    width: number,
    height: number
  },

  // Runtime State (Added during rendering)
  _rendered: boolean,            // Whether overlay has been rendered
  _lastRenderTime: number,       // Timestamp of last render
  _domElement: HTMLElement,      // Reference to DOM element (may be cached)

  // Animation State (If animated)
  _animationState: {
    active: boolean,
    startTime: number,
    duration: number,
    properties: Array<string>
  }
}
```

### Critical Property Usage

| Property | When Added | Used By | Purpose |
|----------|-----------|---------|---------|
| `style` | Config parse | Initial render | Base styles from user config |
| `finalStyle` | Rule evaluation | Incremental update, Re-render | Merged styles with rules applied |
| `resolvedPosition` | Model building | Rendering | Absolute coordinates after anchor resolution |
| `_domElement` | First render | Incremental updates | Reference to existing DOM element |

---

## Overlay Lifecycle States

### State 1: Raw Configuration
```javascript
// From YAML/JSON config
{
  id: "test_button1",
  type: "button",
  position: [1400, 1000],
  style: {
    border: { width: 14, color: "var(--picard-blue)" }
  }
}
```

### State 2: After Model Building
```javascript
// ModelBuilder processes config
{
  id: "test_button1",
  type: "button",
  position: [1400, 1000],
  resolvedPosition: [1400, 1000],  // Anchors resolved
  style: {
    border: { width: 14, color: "var(--picard-blue)" }
  },
  _raw: { /* original config */ },
  _resolved: true
}
```

### State 3: After Rule Evaluation
```javascript
// RulesEngine applies matching rules
{
  id: "test_button1",
  type: "button",
  position: [1400, 1000],
  resolvedPosition: [1400, 1000],
  style: {  // Original base style
    border: { width: 14, color: "var(--picard-blue)" }
  },
  finalStyle: {  // ⭐ CRITICAL: Merged with rule patches
    border: {
      width: 3,  // Modified by rule
      color: "var(--picard-blue)",
      radius_top_left: 0,  // Added by rule
      bottom: { width: 7, color: "var(--picard-lightest-blue)" }  // Added by rule
    }
  },
  _raw: { /* original config */ },
  _resolved: true
}
```

### State 4: After Rendering
```javascript
// Renderer creates DOM element
{
  id: "test_button1",
  type: "button",
  position: [1400, 1000],
  resolvedPosition: [1400, 1000],
  style: { /* base style */ },
  finalStyle: { /* patched style */ },
  _rendered: true,
  _lastRenderTime: 1761409250374,
  _domElement: <reference to SVG <g> element>,
  _raw: { /* original config */ },
  _resolved: true
}
```

---

## Data Flow Through Pipeline

### Full Render Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER CONFIGURATION                          │
│                           (YAML/JSON)                               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          CONFIG PARSER                              │
│  • Parse YAML/JSON                                                  │
│  • Create base overlay objects                                      │
│  • Properties: id, type, position, size, style                      │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MODEL BUILDER                               │
│  • Resolve anchors → resolvedPosition                               │
│  • Validate configurations                                          │
│  • Store in resolvedModel                                           │
│  • Properties added: resolvedPosition, _raw, _resolved              │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         RULES ENGINE                                │
│  • Evaluate state_rules conditions                                  │
│  • Generate patches for matching rules                              │
│  • Create patch objects: { id, type, style, content }              │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       SYSTEMS MANAGER                               │
│  • Merge patches into overlay.finalStyle                            │
│  • Try incremental update first                                     │
│  • If incremental fails → schedule selective re-render              │
│  • Properties added: finalStyle                                     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      OVERLAY RENDERER                               │
│  • Check: use overlay.finalStyle || overlay.style                   │
│  • Resolve styles with theme/presets                                │
│  • Generate SVG markup                                               │
│  • Return: { markup, actionInfo, metadata }                         │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ADVANCED RENDERER                              │
│  • Parse SVG with DOMParser (XML parser)                            │
│  • Import and append to DOM                                          │
│  • Attach actions via ActionHelpers                                 │
│  • Store reference: overlay._domElement                              │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            DOM / BROWSER                            │
│  • Display rendered SVG                                              │
│  • Handle user interactions                                          │
│  • Trigger state changes → loop back to Rules Engine               │
└─────────────────────────────────────────────────────────────────────┘
```

### Incremental Update Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                       STATE CHANGE EVENT                            │
│                    (e.g., light.tv toggles)                         │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         RULES ENGINE                                │
│  • Evaluate rules for changed entity                                │
│  • Generate patches: [{ id, type, style }]                          │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       SYSTEMS MANAGER                               │
│  • For each patch:                                                   │
│    1. Find overlay in resolvedModel                                 │
│    2. Merge patch.style into overlay.finalStyle                     │
│    3. Call overlay.updateIncremental(overlay, element, context)     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
        ┌───────────────────────┐ ┌──────────────────────┐
        │  INCREMENTAL SUCCESS  │ │  INCREMENTAL FAILED  │
        │  (return true)        │ │  (return false)      │
        └───────────┬───────────┘ └──────────┬───────────┘
                    │                         │
                    │                         ▼
                    │           ┌─────────────────────────────┐
                    │           │  SELECTIVE RE-RENDER        │
                    │           │  • Remove old element       │
                    │           │  • Re-render with finalStyle│
                    │           │  • Parse with DOMParser     │
                    │           │  • Append to DOM            │
                    │           │  • Re-attach actions        │
                    │           └─────────────┬───────────────┘
                    │                         │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │    UPDATE COMPLETE     │
                    │  DOM reflects changes  │
                    └────────────────────────┘
```

---

## Style Resolution Hierarchy

Understanding which style takes precedence:

```
┌──────────────────────────────────────────────────────────────────┐
│                    STYLE RESOLUTION ORDER                        │
│                   (Higher Priority First)                        │
└──────────────────────────────────────────────────────────────────┘

1. overlay.finalStyle (if exists)
   ↓ ⭐ HIGHEST PRIORITY
   │  Contains: base style + rule patches
   │  Used by: Incremental updates, Re-renders
   │  Set by: SystemsManager after rule evaluation
   │
2. overlay.style
   ↓  Base configuration style
   │  Contains: user-defined styles from config
   │  Used by: Initial render (if no rules matched)
   │
3. Preset Styles (if lcars_button_preset specified)
   ↓  Theme-defined preset styles
   │  Contains: preset properties from theme packs
   │  Used by: Style resolver during rendering
   │
4. Theme Defaults
   ↓  Global theme-level defaults
   │  Contains: default colors, fonts, sizes
   │  Used by: Style resolver as fallback
   │
5. Hardcoded Defaults
   │ ⭐ LOWEST PRIORITY
   ↓  Fallback values in code
      Contains: 'var(--lcars-blue)', default sizes
      Used by: When no other style defined
```

### Example Resolution

```javascript
// User Config
overlay.style = {
  border: { width: 14, color: "var(--picard-blue)" }
}

// Rule Matches (light.tv == 'on')
patch.style = {
  border: { width: 3, radius_top_left: 0 }
}

// SystemsManager Merges
overlay.finalStyle = {
  border: {
    width: 3,              // From rule (overrides config)
    color: "var(--picard-blue)",  // From config (not in rule)
    radius_top_left: 0     // From rule (new property)
  }
}

// Renderer Uses
const styleToUse = overlay.finalStyle || overlay.style;
// → Uses finalStyle (merged result)
```

---

## Patch Objects

Patches are temporary objects created by RulesEngine to describe style changes:

### Patch Object Structure

```javascript
{
  // Identity
  id: string,                    // Target overlay ID
  type: string,                  // Overlay type (optional)

  // Style Changes
  style: {                       // Only properties that changed
    color: string,               // New color value
    border: {
      width: number,             // New border width
      radius_top_left: number    // New corner radius
    }
    // ... only changed properties included
  },

  // Content Changes (optional)
  content: string,               // New content value
  label: string,                 // New label value

  // Grid-Specific (for status_grid)
  cellTarget: {
    cell_id: string              // Specific cell to update
  },

  // Metadata
  _ruleId: string,               // Which rule generated this patch
  _condition: string             // What condition matched
}
```

### Patch Merging Logic

```javascript
// In SystemsManager._applyIncrementalUpdates()

// 1. Start with base style
const baseStyle = overlay.style || {};

// 2. Get or create finalStyle
if (!overlay.finalStyle) {
  overlay.finalStyle = { ...baseStyle };
}

// 3. Merge patch into finalStyle (deep merge)
if (patch.style) {
  overlay.finalStyle = {
    ...overlay.finalStyle,
    ...patch.style,
    // Special handling for nested objects like border
    border: {
      ...overlay.finalStyle.border,
      ...patch.style.border
    }
  };
}

// 4. finalStyle now has merged result
```

### Patch vs Overlay Relationship

```
┌─────────────────────────────────────────────────────────────┐
│                         OVERLAY                             │
│  {                                                          │
│    id: "test_button1",                                      │
│    style: { color: "blue", border: { width: 14 } },        │
│    finalStyle: undefined  ← Not set yet                     │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                              ▼
                    Rule matches, creates PATCH
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                          PATCH                              │
│  {                                                          │
│    id: "test_button1",                                      │
│    style: { border: { width: 3, radius_top_left: 0 } }     │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                              ▼
                      SystemsManager merges
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   OVERLAY (updated)                         │
│  {                                                          │
│    id: "test_button1",                                      │
│    style: { color: "blue", border: { width: 14 } },        │
│    finalStyle: {  ← ⭐ Now set!                             │
│      color: "blue",  ← From style                           │
│      border: {                                              │
│        width: 3,  ← From patch                              │
│        radius_top_left: 0  ← From patch                     │
│      }                                                      │
│    }                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Context Objects

Context objects are passed to renderers to provide access to system services:

### Render Context

```javascript
{
  // System References
  dataSourceManager: DataSourceManager,  // Access to data sources
  systemsManager: SystemsManager,        // Access to overlay management
  hass: HomeAssistant,                   // Home Assistant connection

  // Rendering Context
  anchors: {                             // Anchor definitions
    [anchorId: string]: [x: number, y: number]
  },
  viewBox: {                             // SVG viewBox dimensions
    x: number,
    y: number,
    width: number,
    height: number
  },

  // Card Instance (for actions)
  cardInstance: CBLCARSMSDCard,          // Card instance for action handling

  // Optional: Patch information (during incremental update)
  patch: {                               // The patch being applied
    id: string,
    style: Object,
    cellTarget: Object  // For status_grid
  }
}
```

### Incremental Update Context

```javascript
{
  // Everything from Render Context, plus:

  // Patch Information
  patch: {                               // ⭐ The patch causing this update
    id: string,
    type: string,
    style: Object,
    cellTarget: Object                   // If targeting specific cell
  },

  // Update Metadata
  updateType: 'incremental',             // Type of update
  timestamp: number,                     // When update triggered
  changedProperties: Array<string>       // What properties changed
}
```

---

## Render Result Objects

Renderers return structured result objects:

### Render Result Structure

```javascript
{
  // SVG Markup
  markup: string,                        // SVG markup string (wrapped in <g>)

  // Action Configuration
  actionInfo: {                          // Action configuration (if overlay has actions)
    config: {
      simple: {                          // Simple action config
        tap_action: ActionConfig,
        hold_action: ActionConfig,
        double_tap_action: ActionConfig
      },
      enhanced: {                        // Enhanced action config (advanced)
        // ... complex action configurations
      }
    },
    hasActions: boolean                  // Whether overlay has any actions
  },

  // Metadata
  overlayId: string,                     // Overlay ID
  metadata: {                            // Additional metadata
    hasLabel: boolean,
    hasContent: boolean,
    preset: string,
    // ... renderer-specific metadata
  },

  // Provenance (tracking)
  provenance: {                          // Renderer information
    renderer: string,                    // Which renderer created this (e.g., "ButtonOverlay")
    version: string,                     // Renderer version
    timestamp: number,                   // When rendered
    overlay_type: string,                // Type of overlay
    // ... additional tracking data
  }
}
```

### Markup Structure

The `markup` string should always be a complete `<g>` element:

```xml
<g data-overlay-id="test_button1"
   data-overlay-type="button"
   data-has-actions="true"
   style="pointer-events: all; cursor: pointer;">

  <!-- Nested button markup -->
  <g data-button-id="test_button1">
    <path d="..." fill="..." />  <!-- Background -->
    <path d="..." stroke="..." /> <!-- Borders -->
    <text>...</text>             <!-- Text content -->
  </g>

</g>
```

**Important:** The markup will be parsed by `DOMParser`, so:
- ✅ Must be valid XML
- ✅ Must use self-closing tags: `<path ... />`
- ✅ Must escape special characters in attributes
- ❌ Don't use HTML-only tags
- ❌ Don't leave tags unclosed

---

## Common Pitfalls & Best Practices

### ❌ WRONG: Using only overlay.style

```javascript
// In render() method
render(overlay, anchors, viewBox) {
  const buttonStyle = this._resolveStyles(overlay.style);  // ❌ Wrong!
  // This ignores rule patches!
}
```

### ✅ CORRECT: Check finalStyle first

```javascript
// In render() method
render(overlay, anchors, viewBox) {
  const styleToUse = overlay.finalStyle || overlay.style || {};  // ✅ Correct!
  const buttonStyle = this._resolveStyles(styleToUse);
}
```

---

### ❌ WRONG: Modifying overlay.style directly

```javascript
// In incremental update
updateIncremental(overlay, element, context) {
  overlay.style.color = context.patch.style.color;  // ❌ Wrong! Mutates config
}
```

### ✅ CORRECT: Use finalStyle (already merged by SystemsManager)

```javascript
// In incremental update
updateIncremental(overlay, element, context) {
  const styleToUse = overlay.finalStyle || overlay.style;  // ✅ Correct!
  // finalStyle already has patch merged
}
```

---

### ❌ WRONG: Using innerHTML to parse SVG

```javascript
// In re-render
const tempDiv = document.createElement('div');
tempDiv.innerHTML = result.markup;  // ❌ Wrong! HTML parser breaks SVG
const element = tempDiv.firstElementChild;
```

### ✅ CORRECT: Use DOMParser with XML mime type

```javascript
// In re-render
const parser = new DOMParser();
const wrappedMarkup = `<svg xmlns="http://www.w3.org/2000/svg">${result.markup}</svg>`;
const svgDoc = parser.parseFromString(wrappedMarkup, 'image/svg+xml');  // ✅ Correct!
const element = svgDoc.documentElement.firstElementChild;
```

---

### ❌ WRONG: Always returning true from updateIncremental

```javascript
updateIncremental(overlay, element, context) {
  // Try to update...
  return true;  // ❌ Wrong! Even if update failed
}
```

### ✅ CORRECT: Return false when full re-render needed

```javascript
updateIncremental(overlay, element, context) {
  if (requiresGeometryRegeneration(overlay.finalStyle)) {
    return false;  // ✅ Correct! Triggers fallback
  }

  const success = updateAttributes(element, overlay.finalStyle);
  return success;  // Return actual result
}
```

---

### ❌ WRONG: Assuming patch has all properties

```javascript
updateIncremental(overlay, element, context) {
  const newColor = context.patch.style.color;  // ❌ Wrong! May be undefined
  element.setAttribute('fill', newColor);
}
```

### ✅ CORRECT: Use merged finalStyle

```javascript
updateIncremental(overlay, element, context) {
  const styleToUse = overlay.finalStyle || overlay.style;  // ✅ Correct!
  const newColor = styleToUse.color || 'var(--lcars-blue)';  // With fallback
  if (newColor !== undefined) {
    element.setAttribute('fill', newColor);
  }
}
```

---

## Quick Reference Cheat Sheet

### When Implementing Overlay Renderer

```javascript
class MyOverlay {
  // ✅ Always check finalStyle first
  render(overlay, anchors, viewBox, svgContainer, cardInstance) {
    const styleToUse = overlay.finalStyle || overlay.style || {};
    const resolvedStyle = this._resolveStyles(styleToUse, overlay);
    // ... render with resolvedStyle
  }

  // ✅ Return false if can't update incrementally
  static updateIncremental(overlay, overlayElement, context) {
    const styleToUse = overlay.finalStyle || overlay.style;

    if (this._requiresFullReRender(styleToUse)) {
      return false;  // Trigger fallback
    }

    const success = this._updateAttributes(overlayElement, styleToUse);
    return success;
  }
}
```

### When Debugging

```javascript
// Check what properties are available
console.log('Overlay ID:', overlay.id);
console.log('Has finalStyle?', !!overlay.finalStyle);
console.log('finalStyle keys:', overlay.finalStyle ? Object.keys(overlay.finalStyle) : 'none');
console.log('Base style keys:', overlay.style ? Object.keys(overlay.style) : 'none');

// Check if rule patches were applied
console.log('Style color:', overlay.style?.color);
console.log('FinalStyle color:', overlay.finalStyle?.color);
console.log('Are they different?', overlay.style?.color !== overlay.finalStyle?.color);
```

### When Writing Tests

```javascript
// Set up overlay with both style and finalStyle
const testOverlay = {
  id: 'test_overlay',
  type: 'button',
  style: { color: 'blue' },      // Base config
  finalStyle: { color: 'red' }   // After rule patch
};

// Test should use finalStyle
const result = renderer.render(testOverlay, {}, {});
expect(result.markup).toContain('fill="red"');  // Not blue!
```

---

## Conclusion

Understanding these data structures is critical for:

1. **Implementing Incremental Updates:** Know when to use `finalStyle` vs `style`
2. **Debugging Rendering Issues:** Trace data flow from config to DOM
3. **Adding New Overlay Types:** Follow established patterns
4. **Optimizing Performance:** Understand what triggers full vs incremental updates

**Key Takeaways:**

- ⭐ **Always use `overlay.finalStyle || overlay.style`** in render methods
- ⭐ **Patches merge into `finalStyle`**, not `style`
- ⭐ **Return `false` from `updateIncremental()`** when full re-render needed
- ⭐ **Use `DOMParser` with XML wrapper** for parsing SVG markup
- ⭐ **Don't mutate `overlay.style`** - it's the base config

---

**Next Steps:** With this understanding, you can confidently implement incremental updates for other overlay types (TextOverlay, StatusGridOverlay, etc.) following the same patterns established for ButtonOverlay.
