# CB-LCARS Runtime API Reference

> **User-facing stable API** for interacting with MSD cards from the browser console, Home Assistant automations, or custom scripts.

## Quick Start

All Runtime API methods are accessed through the global `window.cblcars.msd` namespace:

```javascript
// Instance management
const instance = window.cblcars.msd.getCurrentInstance();

// State & configuration
const state = window.cblcars.msd.getState();
const config = window.cblcars.msd.getConfig();

// Validation
const validation = window.cblcars.msd.validate();

// Overlays
const overlays = window.cblcars.msd.overlays.list();
window.cblcars.msd.overlays.highlight('overlay_id');

// Themes
const themes = window.cblcars.msd.theme.list();
const current = window.cblcars.msd.theme.getCurrent();
window.cblcars.msd.theme.apply('lcars-ds9');
```

---

## Table of Contents

- [Instance Management](#instance-management)
- [State & Configuration](#state--configuration)
- [Validation](#validation)
- [Overlay Operations](#overlay-operations)
- [Theme Management](#theme-management)

---

## Instance Management

### `getInstance(cardId)`

Get a specific MSD card instance by ID.

**Parameters:**
- `cardId` (string, optional) - Card ID. If omitted, returns current instance.

**Returns:** `Object|null` - Instance object or null if not found

**Example:**
```javascript
const instance = window.cblcars.msd.getInstance();
console.log('Instance:', instance);

// Access instance properties
console.log('Has renderer:', !!instance.renderer);
console.log('Has systemsManager:', !!instance.systemsManager);
```

---

### `getCurrentInstance()`

Get the current active MSD card instance.

**Returns:** `Object|null` - Current instance or null if none active

**Example:**
```javascript
const current = window.cblcars.msd.getCurrentInstance();
if (current) {
  console.log('Current instance found');
  const model = current.getResolvedModel();
  console.log('Overlays:', model.overlays.length);
}
```

---

### `getAllInstances()`

Get all MSD card instances (multi-instance support - future).

**Returns:** `Array` - Array of instance objects (currently single instance)

**Example:**
```javascript
const instances = window.cblcars.msd.getAllInstances();
console.log(`Found ${instances.length} instance(s)`);
```

---

## State & Configuration

### `getState(cardId)`

Get the current runtime state of an MSD card.

Returns the resolved model with all overlays, anchors, viewBox, and computed properties.

**Parameters:**
- `cardId` (string, optional) - Card ID. If omitted, uses current instance.

**Returns:** `Object|null` - Resolved model or null if not available

**Properties:**
- `overlays` (Array) - All rendered overlays with positions and styles
- `anchors` (Object) - Available anchor points
- `viewBox` (Array) - SVG viewBox `[minX, minY, width, height]`
- `config` (Object) - Merged configuration

**Example:**
```javascript
const state = window.cblcars.msd.getState();

console.log('ViewBox:', state.viewBox);
console.log('Overlays:', state.overlays.length);
console.log('Anchors:', Object.keys(state.anchors));

// Access specific overlay
const titleOverlay = state.overlays.find(o => o.id === 'title_overlay');
console.log('Title position:', titleOverlay.position);
```

---

### `getConfig(cardId)`

Get the configuration of an MSD card.

Returns the same as `getState()` - provides access to the resolved model.

**Parameters:**
- `cardId` (string, optional) - Card ID. If omitted, uses current instance.

**Returns:** `Object|null` - Configuration object or null if not available

**Example:**
```javascript
const config = window.cblcars.msd.getConfig();

// Iterate through all overlays
config.overlays.forEach(overlay => {
  console.log(`${overlay.id}: ${overlay.type} at [${overlay.position}]`);
});
```

---

## Validation

### `validate(cardId)`

Validate the MSD configuration and report issues.

Returns comprehensive validation results from the pipeline's validation system, including schema validation and overlay validation.

**Parameters:**
- `cardId` (string, optional) - Card ID. If omitted, uses current instance.

**Returns:** `Object|null` - Validation results or null if not available

**Result Structure:**
```javascript
{
  valid: boolean,              // Overall validation status
  overlayCount: number,        // Number of overlays validated
  errors: Array,               // Critical errors
  warnings: Array,             // Warnings (non-blocking)
  errorCount: number,          // Total error count
  warningCount: number,        // Total warning count
  overlays: Object            // Per-overlay validation results
}
```

**Example:**
```javascript
const validation = window.cblcars.msd.validate();

console.log('Valid:', validation.valid);
console.log('Overlays:', validation.overlayCount);
console.log('Errors:', validation.errorCount);
console.log('Warnings:', validation.warningCount);

// Show errors
if (validation.errors.length > 0) {
  console.log('Validation errors:');
  validation.errors.forEach(err => {
    console.log(`  - ${err.message}`);
  });
}

// Show warnings
if (validation.warnings.length > 0) {
  console.log('Validation warnings:');
  validation.warnings.forEach(warn => {
    console.log(`  - ${warn.message}`);
  });
}

// Check specific overlay
const overlayValidation = validation.overlays['status_grid_1'];
if (overlayValidation) {
  console.log('Status grid valid:', overlayValidation.valid);
  console.log('Issues:', overlayValidation.issues);
}
```

---

## Overlay Operations

### `overlays.list(cardId)`

List all overlays in the MSD card.

Returns a simplified array of overlay objects with basic information (id, type, position, size).

**Parameters:**
- `cardId` (string, optional) - Card ID. If omitted, uses current instance.

**Returns:** `Array` - Array of overlay objects

**Overlay Object:**
```javascript
{
  id: string,           // Overlay identifier
  type: string,         // Overlay type (text, button, status_grid, etc.)
  position: [x, y],     // Position coordinates
  size: [w, h]          // Size dimensions
}
```

**Example:**
```javascript
const overlays = window.cblcars.msd.overlays.list();

console.log(`Found ${overlays.length} overlays`);

// List all overlays
overlays.forEach(overlay => {
  console.log(`${overlay.id} (${overlay.type}):`, overlay.position);
});

// Find specific overlay types
const textOverlays = overlays.filter(o => o.type === 'text');
console.log('Text overlays:', textOverlays.map(o => o.id));

const statusGrids = overlays.filter(o => o.type === 'status_grid');
console.log('Status grids:', statusGrids.length);
```

---

### `overlays.highlight(overlayId, duration)`

Temporarily highlight an overlay with a colored border.

Draws a yellow rectangle around the overlay for visual identification. Useful for debugging layout issues or demonstrating overlay positions.

**Parameters:**
- `cardId` (string, optional) - Card ID. Can be omitted in single-instance mode.
- `overlayId` (string) - Overlay ID to highlight
- `duration` (number, optional) - Highlight duration in milliseconds (default: 2000)

**Flexible Arguments:**
- `highlight(overlayId)` - Highlight for 2 seconds
- `highlight(overlayId, duration)` - Highlight with custom duration
- `highlight(cardId, overlayId, duration)` - Full signature (future)

**Returns:** `undefined`

**Example:**
```javascript
// Highlight overlay for 2 seconds (default)
window.cblcars.msd.overlays.highlight('title_overlay');

// Highlight for 5 seconds
window.cblcars.msd.overlays.highlight('status_grid_1', 5000);

// Highlight multiple overlays sequentially
const overlays = window.cblcars.msd.overlays.list();
let delay = 0;
overlays.forEach(overlay => {
  setTimeout(() => {
    window.cblcars.msd.overlays.highlight(overlay.id, 1000);
  }, delay);
  delay += 1500;
});
```

**Supported Overlay Types:**
- ✅ Text overlays
- ✅ Button overlays
- ✅ Line overlays
- ✅ Status grid overlays
- ✅ ApexChart overlays
- ✅ Control overlays (foreignObject)

---

### `overlays.show(cardId, overlayId)` ⚠️ Not Implemented

Show a hidden overlay (placeholder - not yet implemented).

**Status:** Planned for future release

---

### `overlays.hide(cardId, overlayId)` ⚠️ Not Implemented

Hide a visible overlay (placeholder - not yet implemented).

**Status:** Planned for future release

---

## Theme Management

### `theme.list()`

List all available themes.

Returns an array of theme objects with metadata (id, name, description, pack source).

**Returns:** `Array` - Array of theme info objects

**Theme Object:**
```javascript
{
  id: string,              // Theme identifier (e.g., 'lcars-classic')
  name: string,            // Display name (e.g., 'LCARS Classic')
  description: string,     // Theme description
  packId: string,          // Source pack ID
  hasCssFile: boolean      // Whether theme has CSS file
}
```

**Example:**
```javascript
const themes = window.cblcars.msd.theme.list();

console.log('Available themes:');
themes.forEach(theme => {
  console.log(`  ${theme.id}: ${theme.name}`);
  console.log(`    Description: ${theme.description}`);
  console.log(`    From pack: ${theme.packId}`);
});

// Get just the theme IDs
const themeIds = themes.map(t => t.id);
console.log('Theme IDs:', themeIds);
```

---

### `theme.getCurrent(cardId)`

Get the currently active theme.

Returns detailed information about the active theme including tokens.

**Parameters:**
- `cardId` (string, optional) - Card ID. If omitted, uses current instance.

**Returns:** `Object|null` - Current theme info or null if not available

**Theme Info:**
```javascript
{
  id: string,              // Theme identifier
  name: string,            // Display name
  description: string,     // Theme description
  packId: string,          // Source pack ID
  tokens: Object,          // Theme token structure
  colors: Object,          // Color tokens
  typography: Object,      // Typography tokens
  components: Object       // Component defaults
}
```

**Example:**
```javascript
const theme = window.cblcars.msd.theme.getCurrent();

console.log('Current theme:', theme.name);
console.log('Theme ID:', theme.id);
console.log('From pack:', theme.packId);

// Access theme tokens
console.log('Primary color:', theme.colors?.accent?.primary);
console.log('Font family:', theme.typography?.fontFamily);

// Access component defaults
const gridDefaults = theme.components?.statusGrid;
if (gridDefaults) {
  console.log('Status grid cell gap:', gridDefaults.cellGap);
  console.log('Status grid text padding:', gridDefaults.textPadding);
}
```

---

### `theme.apply(themeName)` / `theme.apply(cardId, themeName)`

Apply a different theme to the MSD card.

Activates a new theme, affecting all overlays and components that use theme tokens. The theme change is immediate and updates all styled elements.

**Parameters:**
- `cardId` (string, optional) - Card ID. Can be omitted in single-instance mode.
- `themeName` (string) - Theme ID to apply

**Flexible Arguments:**
- `apply(themeName)` - Apply theme (single-instance)
- `apply(cardId, themeName)` - Apply to specific card (future)

**Returns:** `boolean` - Success status

**Example:**
```javascript
// List available themes first
const themes = window.cblcars.msd.theme.list();
console.log('Available:', themes.map(t => t.id));

// Apply a different theme
const success = window.cblcars.msd.theme.apply('lcars-ds9');
console.log('Theme applied:', success);

// Verify theme was applied
const current = window.cblcars.msd.theme.getCurrent();
console.log('New theme:', current.name);

// Switch back to classic
window.cblcars.msd.theme.apply('lcars-classic');
```

**Error Handling:**
```javascript
const result = window.cblcars.msd.theme.apply('nonexistent-theme');
// Returns: false
// Console shows: Theme not found: nonexistent-theme
// Console shows: Available themes: ['lcars-classic', 'lcars-ds9', ...]
```

---

## Common Patterns

### Inspect Current MSD State

```javascript
// Get all the info
const instance = window.cblcars.msd.getCurrentInstance();
const state = window.cblcars.msd.getState();
const validation = window.cblcars.msd.validate();
const overlays = window.cblcars.msd.overlays.list();
const theme = window.cblcars.msd.theme.getCurrent();

console.log('=== MSD Card Status ===');
console.log('Instance:', !!instance);
console.log('ViewBox:', state.viewBox);
console.log('Overlays:', overlays.length);
console.log('Valid:', validation.valid);
console.log('Errors:', validation.errorCount);
console.log('Warnings:', validation.warningCount);
console.log('Theme:', theme.name);
```

### Find and Highlight Overlays

```javascript
// Find all status grids
const statusGrids = window.cblcars.msd.overlays.list()
  .filter(o => o.type === 'status_grid');

console.log('Found status grids:', statusGrids.map(o => o.id));

// Highlight each one
statusGrids.forEach(grid => {
  console.log('Highlighting:', grid.id);
  window.cblcars.msd.overlays.highlight(grid.id, 3000);
});
```

### Validate and Report Issues

```javascript
const validation = window.cblcars.msd.validate();

if (!validation.valid) {
  console.error('❌ Validation failed!');

  if (validation.errors.length > 0) {
    console.error('Errors:');
    validation.errors.forEach(err => console.error(`  - ${err.message}`));
  }

  if (validation.warnings.length > 0) {
    console.warn('Warnings:');
    validation.warnings.forEach(warn => console.warn(`  - ${warn.message}`));
  }
} else {
  console.log('✅ Configuration valid!');
}
```

### Theme Exploration

```javascript
// List all themes
const themes = window.cblcars.msd.theme.list();
console.log('Available themes:');
themes.forEach(t => console.log(`  - ${t.id}: ${t.name}`));

// Try each theme
themes.forEach((theme, index) => {
  setTimeout(() => {
    console.log(`Switching to: ${theme.name}`);
    window.cblcars.msd.theme.apply(theme.id);
  }, index * 3000);
});
```

---

## API Design Notes

### Single-Instance Mode (Phase 0)

The current implementation supports a single MSD card instance. Many methods accept an optional `cardId` parameter for future multi-instance support, but currently:

- If `cardId` is provided, it's ignored
- The API operates on the current/only instance
- Multi-instance support will be added in a future phase

### Flexible Arguments

Some methods support flexible argument patterns:

```javascript
// These are equivalent in single-instance mode:
window.cblcars.msd.overlays.highlight('my_overlay');
window.cblcars.msd.overlays.highlight(null, 'my_overlay');
window.cblcars.msd.overlays.highlight('ignored-card-id', 'my_overlay');
```

### Error Handling

Runtime API methods follow these conventions:

- **No exceptions thrown** - Methods log errors but don't throw
- **Graceful degradation** - Return null/empty array/false on error
- **Console logging** - Errors and warnings logged to browser console
- **Status returns** - Boolean methods return true/false for success/failure

---

## Related Documentation

- **Debug API** - Advanced debugging and introspection (Phase 1)
- **Animation API** - Animation system and helpers
- **Theme System** - Theme creation and token reference

---

*Last updated: 2025-10-29 - Phase 0 Complete*
