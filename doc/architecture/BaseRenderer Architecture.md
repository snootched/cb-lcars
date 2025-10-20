# BaseRenderer Architecture Reference

This document explains the BaseRenderer base class that all MSD overlay renderers extend, providing shared functionality for theme integration, logging, and rendering utilities.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Features](#core-features)
4. [Extending BaseRenderer](#extending-baserenderer)
5. [API Reference](#api-reference)
6. [Migration Guide](#migration-guide)

---

## Overview

The BaseRenderer is an abstract base class that provides common functionality for all MSD overlay renderers. It consolidates theme management, default value resolution, token handling, and logging into a single, maintainable class.

### **Benefits:**
- ✅ Eliminates 200-300 lines of duplicate code across renderers
- ✅ Consistent theme integration patterns
- ✅ Unified logging with minification-safe renderer names
- ✅ Single source of truth for ThemeManager resolution
- ✅ Easy to extend with new renderers

---

## Architecture

```
BaseRenderer (abstract base class)
├── ThemeManager Integration
│   ├── _resolveThemeManager()
│   └── _getThemeManager()
├── Default Value Resolution
│   └── _getDefault(path, fallback)
├── Token System
│   ├── _resolveStyleProperty()
│   └── _isTokenReference()
├── Scaling Context
│   └── _getScalingContext(fallbackViewBox)
├── Logging Utilities
│   ├── _logDebug(message, ...args)
│   ├── _logWarn(message, ...args)
│   └── _logError(message, ...args)
└── Container Resolution
    └── _resolveContainerElement()

Renderers Extending BaseRenderer
├── TextOverlayRenderer
├── StatusGridRenderer
├── ButtonOverlayRenderer
├── core/ButtonRenderer
└── LineOverlayRenderer

Pure Utility Renderers (No Extension)
├── core/TextRenderer
└── BracketRenderer
```

---

## Core Features

### 1. ThemeManager Integration

**Purpose:** Resolve ThemeManager instance from multiple sources

**Implementation:**
```javascript
_resolveThemeManager() {
  // 1. Global CB-LCARS namespace (preferred)
  if (window.cblcars?.theme) return window.cblcars.theme;

  // 2. Pipeline instance via systemsManager
  const pipeline = window.__msdDebug?.pipelineInstance;
  if (pipeline?.systemsManager?.themeManager) return pipeline.systemsManager.themeManager;

  // 3. Direct pipeline access
  if (pipeline?.themeManager) return pipeline.themeManager;

  // 4. Systems manager global reference
  const systems = window.__msdDebug?.systemsManager;
  if (systems?.themeManager) return systems.themeManager;

  return null;
}
```

**Usage in Subclass:**
```javascript
// Automatically called in constructor
constructor() {
  super(); // themeManager is now available
  this.rendererName = 'MyRenderer';
}
```

---

### 2. Default Value Resolution

**Purpose:** Get component-specific defaults from active theme

**Implementation:**
```javascript
_getDefault(path, fallback = null) {
  const themeManager = this._resolveThemeManager();
  if (!themeManager?.initialized) return fallback;

  // Convert 'componentType.property' to ThemeManager format
  const [componentType, ...propertyParts] = path.split('.');
  const property = propertyParts.join('.');

  return themeManager.getDefault(componentType, property, fallback);
}
```

**Usage Examples:**
```javascript
// Get status grid text padding
const padding = this._getDefault('statusGrid.textPadding', 8);

// Get text default color
const color = this._getDefault('text.defaultColor', '#FFFFFF');

// Get line default width
const width = this._getDefault('line.defaultWidth', 2);
```

---

### 3. Token System Integration

**Purpose:** Resolve token references and style properties

**Token Detection:**
```javascript
_isTokenReference(value) {
  if (typeof value !== 'string') return false;

  const categories = ['colors', 'typography', 'spacing', 'borders',
                      'effects', 'animations', 'components'];
  return categories.some(cat => value.startsWith(`${cat}.`));
}
```

**Style Property Resolution:**
```javascript
_resolveStyleProperty(styleValue, tokenPath, resolveToken, fallback, context) {
  // If style explicitly set, use it (resolve token if needed)
  if (styleValue !== undefined && styleValue !== null) {
    if (this._isTokenReference(styleValue)) {
      return resolveToken(styleValue, fallback, context);
    }
    return styleValue;
  }

  // Otherwise resolve from token system
  if (resolveToken) {
    return resolveToken(tokenPath, fallback, context);
  }

  return fallback;
}
```

**Usage Example:**
```javascript
const color = this._resolveStyleProperty(
  style.color,                    // User value
  'defaultColor',                 // Token path
  resolveToken,                   // Token resolver
  this._getDefault('line.defaultColor', '#FF9900'), // Fallback
  scalingContext                  // Context
);
```

---

### 4. Logging System

**Purpose:** Consistent logging with renderer name (minification-safe)

**Implementation:**
```javascript
// Subclass sets explicit name
constructor() {
  super();
  this.rendererName = 'StatusGridRenderer'; // Not minified
}

// Logging methods use explicit name
_logDebug(message, ...args) {
  cblcarsLog.debug(`[${this.rendererName}] ${message}`, ...args);
}
```

**Usage:**
```javascript
this._logDebug('Rendering status grid with', cells.length, 'cells');
this._logWarn('⚠️ Missing theme manager, using fallback');
this._logError('❌ Invalid configuration:', error);
```

**Output:**
```
[StatusGridRenderer] Rendering status grid with 12 cells
[LineOverlayRenderer] ⚠️ Missing theme manager, using fallback
[TextOverlayRenderer] ❌ Invalid configuration: Error: ...
```

---

### 5. Scaling Context

**Purpose:** Provide viewBox and container for responsive calculations

**Implementation:**
```javascript
_getScalingContext(fallbackViewBox = null) {
  const viewBox = this.viewBox || fallbackViewBox || [0, 0, 400, 200];
  return {
    viewBox: viewBox,
    containerElement: this.container
  };
}
```

**Usage:**
```javascript
const context = this._getScalingContext(viewBox);
// context.viewBox = [0, 0, 400, 200]
// context.containerElement = <SVG element>
```

---

## Extending BaseRenderer

### Step 1: Import and Extend

```javascript
import { BaseRenderer } from './BaseRenderer.js';

export class MyCustomRenderer extends BaseRenderer {
  constructor() {
    super(); // REQUIRED: Call parent constructor
    this.rendererName = 'MyCustomRenderer'; // REQUIRED: Set name

    // Your custom initialization
    this.customProperty = 'value';
  }
}
```

### Step 2: Use Inherited Methods

```javascript
renderMyOverlay(overlay, anchors, viewBox) {
  // Set viewBox for context
  this.viewBox = viewBox;

  // Get theme defaults
  const color = this._getDefault('myComponent.defaultColor', '#FF9900');
  const size = this._getDefault('myComponent.defaultSize', 16);

  // Resolve style properties with tokens
  const finalColor = this._resolveStyleProperty(
    overlay.style?.color,
    'defaultColor',
    resolveToken,
    color,
    this._getScalingContext()
  );

  // Use logging
  this._logDebug('Rendering overlay with color:', finalColor);

  // Your rendering logic...
  return svgMarkup;
}
```

### Step 3: Add Component Defaults to Theme

```javascript
// In lcarsClassicTokens.js
components: {
  myComponent: {
    defaultColor: 'colors.accent.primary',
    defaultSize: 'typography.fontSize.base',
    defaultOpacity: 'effects.opacity.base'
  }
}
```

---

## API Reference

### Constructor

```javascript
constructor()
```
- Initializes ThemeManager reference
- Sets up container and viewBox properties
- **Subclasses MUST:**
  - Call `super()`
  - Set `this.rendererName`

---

### Theme Methods

#### `_resolveThemeManager()`
```javascript
_resolveThemeManager(): Object|null
```
Resolves ThemeManager instance from multiple sources.

**Returns:** ThemeManager instance or null

---

#### `_getThemeManager()`
```javascript
_getThemeManager(): Object|null
```
Wrapper for `_resolveThemeManager()`.

**Returns:** ThemeManager instance or null

---

#### `_getDefault(path, fallback)`
```javascript
_getDefault(path: string, fallback: any = null): any
```
Gets component default value from active theme.

**Parameters:**
- `path` - Dot-notation path (e.g., 'statusGrid.textPadding')
- `fallback` - Fallback value if not found

**Returns:** Resolved value or fallback

**Example:**
```javascript
const padding = this._getDefault('statusGrid.textPadding', 8);
```

---

### Token Methods

#### `_isTokenReference(value)`
```javascript
_isTokenReference(value: any): boolean
```
Checks if value is a token reference.

**Parameters:**
- `value` - Value to check

**Returns:** True if token reference

**Example:**
```javascript
this._isTokenReference('colors.accent.primary'); // true
this._isTokenReference('#FF9900'); // false
```

---

#### `_resolveStyleProperty(styleValue, tokenPath, resolveToken, fallback, context)`
```javascript
_resolveStyleProperty(
  styleValue: any,
  tokenPath: string,
  resolveToken: Function|null,
  fallback: any,
  context: Object
): any
```
Resolves style property with token support.

**Parameters:**
- `styleValue` - User-provided value
- `tokenPath` - Token path to resolve
- `resolveToken` - Token resolver function
- `fallback` - Fallback value
- `context` - Scaling context

**Returns:** Resolved property value

---

### Logging Methods

#### `_logDebug(message, ...args)`
```javascript
_logDebug(message: string, ...args: any[]): void
```
Logs debug message with renderer name prefix.

---

#### `_logWarn(message, ...args)`
```javascript
_logWarn(message: string, ...args: any[]): void
```
Logs warning message with renderer name prefix.

---

#### `_logError(message, ...args)`
```javascript
_logError(message: string, ...args: any[]): void
```
Logs error message with renderer name prefix.

---

### Utility Methods

#### `_getScalingContext(fallbackViewBox)`
```javascript
_getScalingContext(fallbackViewBox: Array|null = null): Object
```
Gets scaling context for responsive calculations.

**Parameters:**
- `fallbackViewBox` - Fallback viewBox [x, y, width, height]

**Returns:** `{ viewBox, containerElement }`

---

#### `_resolveContainerElement()`
```javascript
_resolveContainerElement(): Element|null
```
Resolves container element from various sources.

**Returns:** Container element or null

---

## Migration Guide

### From Direct Implementation to BaseRenderer

**Before:**
```javascript
export class MyRenderer {
  constructor() {
    // Manual ThemeManager resolution
    this.themeManager = window.cblcars?.theme || null;
  }

  _resolveThemeManager() {
    // Duplicate implementation (30+ lines)
  }

  _getDefault(path, fallback) {
    // Duplicate implementation (20+ lines)
  }

  _isTokenReference(value) {
    // Duplicate implementation (10+ lines)
  }
}
```

**After:**
```javascript
import { BaseRenderer } from './BaseRenderer.js';

export class MyRenderer extends BaseRenderer {
  constructor() {
    super(); // Get all shared functionality
    this.rendererName = 'MyRenderer';
  }

  // Remove all duplicate methods - inherited from BaseRenderer
  // Keep only renderer-specific methods
}
```

**Lines Removed:** ~60-80 per renderer
**Total Savings:** ~300 lines across 5 renderers

---

## Best Practices

### 1. Always Set Renderer Name
```javascript
constructor() {
  super();
  this.rendererName = 'MyRenderer'; // REQUIRED for logging
}
```

### 2. Use Inherited Logging
```javascript
// ✅ GOOD
this._logDebug('Processing overlay');

// ❌ BAD
cblcarsLog.debug('[MyRenderer] Processing overlay');
```

### 3. Use _getDefault for Theme Values
```javascript
// ✅ GOOD
const color = this._getDefault('myComponent.color', '#FF9900');

// ❌ BAD
const color = this.themeManager?.getDefault('myComponent', 'color', '#FF9900');
```

### 4. Set ViewBox Before Using Context
```javascript
render(overlay, anchors, viewBox) {
  this.viewBox = viewBox; // Set first
  const context = this._getScalingContext(); // Then use
}
```

---

## Testing BaseRenderer Integration

### Verify Theme Resolution
```javascript
const renderer = new MyRenderer();
console.log('ThemeManager:', renderer.themeManager);
// Should show ThemeManager instance
```

### Verify Default Resolution
```javascript
const value = renderer._getDefault('myComponent.property', 'fallback');
console.log('Resolved value:', value);
// Should show theme value or fallback
```

### Verify Logging
```javascript
renderer._logDebug('Test message');
// Console: [MyRenderer] Test message
```

---

This architecture provides a solid foundation for consistent, maintainable MSD overlay rendering! 🎨✨