# Overlay Implementation Guide

## Overview

This guide documents the standardized approach for implementing and integrating overlays in the MSD system. Following these patterns ensures proper initial rendering, dynamic updates, and template processing.

## Architecture Overview

The MSD overlay system uses a **unified delegation pattern** where:

1. **AdvancedRenderer** orchestrates overlay rendering and delegates to specialized renderers
2. **BaseOverlayUpdater** handles DataSource change notifications and delegates to appropriate updaters
3. **Specialized Renderers** (TextOverlayRenderer, StatusGridRenderer, etc.) handle type-specific logic

## Standardized Code Paths

### Initial Rendering Flow
```
MSD Pipeline → AdvancedRenderer.render() → AdvancedRenderer.renderOverlay() → {Type}Renderer.render()
```

### Dynamic Update Flow
```
DataSource Change → BaseOverlayUpdater.updateOverlaysForDataSourceChanges() → BaseOverlayUpdater._update{Type}Overlay() → AdvancedRenderer.updateOverlayData() → {Type}Renderer.update{Type}Data()
```

## Implementing a New Overlay Type

### 1. Create the Renderer Class

Create a new renderer class following this template:

```javascript
// src/msd/renderer/{Type}OverlayRenderer.js
export class {Type}OverlayRenderer {
  constructor() {
    // Initialize any caches or state
  }

  /**
   * Render overlay to SVG markup (static method for initial rendering)
   * @param {Object} overlay - Overlay configuration with resolved styles
   * @param {Object} anchors - Anchor positions
   * @param {Array} viewBox - SVG viewBox dimensions
   * @param {Element} svgContainer - Container element for measurements
   * @returns {string} Complete SVG markup
   */
  static render(overlay, anchors, viewBox, svgContainer) {
    const instance = new {Type}OverlayRenderer();
    instance.container = svgContainer;
    instance.viewBox = viewBox;

    // CRITICAL: Pass systemsManager if available for DataSource access
    instance.systemsManager = svgContainer?.systemsManager || window.__msdSystemsManager;

    return instance.renderOverlay(overlay, anchors, viewBox);
  }

  /**
   * Instance method for rendering
   */
  renderOverlay(overlay, anchors, viewBox) {
    // 1. Resolve position
    const position = PositionResolver.resolvePosition(overlay.position, anchors);
    if (!position) return '';

    // 2. Process styles
    const style = overlay.finalStyle || overlay.style || {};

    // 3. Handle template processing for initial render
    let content = this._getOverlayContent(overlay, style);
    if (this._hasTemplates(content)) {
      content = this._processTemplatesForInitialRender(overlay, style, content);
    }

    // 4. Generate SVG markup
    return this._buildSvgMarkup(overlay, position, content, style);
  }

  /**
   * Update overlay content dynamically (static method for delegation pattern)
   * @param {Element} overlayElement - Cached DOM element
   * @param {Object} overlay - Overlay configuration
   * @param {Object} sourceData - New DataSource data
   * @returns {boolean} True if content was updated
   */
  static update{Type}Data(overlayElement, overlay, sourceData) {
    try {
      // Find relevant DOM elements within the overlay
      const targetElement = overlayElement.querySelector('[data-updatable]');
      if (!targetElement) {
        console.warn(`[{Type}OverlayRenderer] No updatable element found in overlay: ${overlay.id}`);
        return false;
      }

      // Create renderer instance for processing
      const renderer = new {Type}OverlayRenderer();

      // Process new content with templates
      const newContent = renderer._processContent(overlay, overlay.finalStyle || {}, sourceData);

      // Update DOM if content changed
      if (newContent !== targetElement.textContent) {
        targetElement.textContent = newContent;
        console.log(`[{Type}OverlayRenderer] ✅ Updated overlay ${overlay.id}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`[{Type}OverlayRenderer] Error updating overlay ${overlay.id}:`, error);
      return false;
    }
  }

  /**
   * Process templates during initial render
   */
  _processTemplatesForInitialRender(overlay, style, content) {
    if (!this._hasTemplates(content)) return content;

    // Try multiple approaches to get DataSource data
    let sourceData = null;

    // 1. Explicit dataSource
    if (overlay.dataSource && this.systemsManager) {
      sourceData = this.systemsManager.getDataSourceData?.(overlay.dataSource);
    }

    // 2. Global data context
    if (!sourceData) {
      sourceData = window.__msdDataContext || overlay._dataContext;
    }

    // 3. All data sources
    if (!sourceData && this.systemsManager) {
      sourceData = this.systemsManager.getAllDataSourceData?.();
    }

    // 4. DataSourceMixin fallback
    if (!sourceData && DataSourceMixin?.getAllData) {
      sourceData = DataSourceMixin.getAllData();
    }

    // Process templates if data available
    if (sourceData) {
      return this._processTemplates(content, sourceData);
    } else {
      console.warn(`[{Type}OverlayRenderer] No DataSource data for template processing: ${overlay.id}`);
      return content;
    }
  }

  /**
   * Template processing logic
   */
  _processTemplates(content, sourceData) {
    if (!sourceData || typeof content !== 'string' || !content.includes('{')) {
      return content;
    }

    return content.replace(/\{([^}]+)\}/g, (match, template) => {
      try {
        // Split template into field path and format
        const [fieldPath, format] = template.split(':');

        // Navigate nested object paths
        const value = fieldPath.split('.').reduce((obj, key) => obj?.[key], sourceData);

        if (value !== undefined && value !== null) {
          // Apply format if specified
          if (format) {
            if (format.includes('f')) {
              const decimals = format.match(/\.(\d+)f/)?.[1];
              if (decimals !== undefined) {
                return Number(value).toFixed(parseInt(decimals));
              }
            } else if (format === '%') {
              return `${value}%`;
            }
          }
          return String(value);
        }

        return match; // Return original if field not found
      } catch (e) {
        console.warn(`[{Type}OverlayRenderer] Template processing failed:`, e);
        return match;
      }
    });
  }

  /**
   * Check if content has template placeholders
   */
  _hasTemplates(content) {
    return content && typeof content === 'string' && content.includes('{');
  }

  // ... other helper methods
}
```

### 2. Register in AdvancedRenderer

Add the new overlay type to `AdvancedRenderer.renderOverlay()`:

```javascript
// In AdvancedRenderer.js
import { {Type}OverlayRenderer } from './{Type}OverlayRenderer.js';

// In renderOverlay() method:
switch (overlay.type) {
  // ... existing cases
  case '{type_name}':
    return {Type}OverlayRenderer.render(overlay, anchors, viewBox, svgContainer);
  // ... other cases
}

// In updateOverlayData() method:
switch (overlay.type) {
  // ... existing cases
  case '{type_name}':
    console.log(`[AdvancedRenderer] Updating {type_name} overlay: ${overlayId}`);
    const updated = {Type}OverlayRenderer.update{Type}Data(overlayElement, overlay, sourceData);
    if (updated) {
      // Handle any post-update logic
    }
    break;
  // ... other cases
}
```

### 3. Register in BaseOverlayUpdater

Add the overlay type to `BaseOverlayUpdater._registerUpdaters()`:

```javascript
// In BaseOverlayUpdater.js
this.overlayUpdaters.set('{type_name}', {
  needsUpdate: (overlay, sourceData) => this._hasTemplateContent(overlay),
  update: (overlayId, overlay, sourceData) => this._update{Type}Overlay(overlayId, overlay, sourceData),
  hasTemplates: (overlay) => this._hasTemplateContent(overlay)
});

// Add update method:
_update{Type}Overlay(overlayId, overlay, sourceData) {
  if (this.systemsManager.renderer && this.systemsManager.renderer.updateOverlayData) {
    this.systemsManager.renderer.updateOverlayData(overlayId, sourceData);
  } else {
    console.warn(`[BaseOverlayUpdater] No renderer method available for {type_name} overlay ${overlayId}`);
  }
}
```

### 4. Update Template Detection (if needed)

If your overlay type stores templates in non-standard properties, update `BaseOverlayUpdater._hasTemplateContent()`:

```javascript
_hasTemplateContent(overlay) {
  // Check standard properties
  const mainContent = overlay._raw?.content || overlay.content || overlay.text || '';
  if (mainContent && typeof mainContent === 'string' && mainContent.includes('{')) {
    return true;
  }

  // Check type-specific properties
  if (overlay.type === '{type_name}') {
    const customContent = overlay.{customProperty} || overlay._raw?.{customProperty} || '';
    if (customContent && typeof customContent === 'string' && customContent.includes('{')) {
      return true;
    }
  }

  return false;
}
```

## Critical Implementation Requirements

### 1. Static Methods for Delegation
- **`static render()`** - For initial rendering via AdvancedRenderer
- **`static update{Type}Data()`** - For dynamic updates via delegation pattern

### 2. SystemsManager Access
Always pass SystemsManager reference for DataSource access:
```javascript
instance.systemsManager = svgContainer?.systemsManager || window.__msdSystemsManager;
```

### 3. Template Processing
- **Initial render**: Process templates with available DataSource data
- **Dynamic updates**: Process templates with provided sourceData
- **Fallback gracefully**: If no data available, use original content

### 4. Element Caching
Return SVG markup with `data-overlay-id` for proper caching:
```javascript
return `<g data-overlay-id="${overlay.id}" data-overlay-type="{type_name}">
  ${content}
</g>`;
```

### 5. Error Handling
- Wrap all operations in try-catch blocks
- Log warnings for missing data or elements
- Return false from update methods if no changes made
- Provide fallback rendering if main rendering fails

## DataSource Integration Patterns

### Template Detection
Overlays with templates are automatically detected by:
1. Content containing `{field}` patterns
2. Registering in `BaseOverlayUpdater._hasTemplateContent()`

### Template Formats Supported
- `{field.path}` - Simple field access
- `{field.path:.1f}` - Decimal formatting
- `{field.path:%}` - Percentage formatting

### DataSource Subscription
No explicit subscription needed. BaseOverlayUpdater automatically:
1. Detects overlays with templates
2. Matches changed entities to overlays
3. Calls update methods with new data

## Testing Your Implementation

### 1. Initial Rendering Test
```javascript
// Verify static render method works
const markup = {Type}OverlayRenderer.render(testOverlay, anchors, viewBox, container);
console.assert(markup.includes('data-overlay-id'), 'Should include overlay ID');
```

### 2. Template Processing Test
```javascript
// Test template processing during initial render
const overlayWithTemplate = {
  id: 'test',
  content: 'Value: {test.value:.1f}',
  // ... other properties
};
// Should process templates if DataSource data available
```

### 3. Dynamic Update Test
```javascript
// Test delegation pattern
const updated = {Type}OverlayRenderer.update{Type}Data(element, overlay, newData);
console.assert(typeof updated === 'boolean', 'Should return boolean');
```

### 4. Integration Test
```javascript
// Test full flow: BaseOverlayUpdater → AdvancedRenderer → {Type}Renderer
// Trigger DataSource change and verify overlay updates
```

## Troubleshooting Guide

### Issue: Templates not processing during initial render
**Solution**: Ensure SystemsManager is passed to renderer instance

### Issue: Dynamic updates not working
**Solution**:
1. Check if overlay type is registered in BaseOverlayUpdater
2. Verify `update{Type}Data` static method exists
3. Ensure `_hasTemplateContent` detects your templates

### Issue: "No renderer method available" warning
**Solution**: Ensure AdvancedRenderer has `updateOverlayData` method and overlay type case

### Issue: Templates processing but updates not visible
**Solution**:
1. Check if update method returns correct boolean
2. Verify DOM element selection in `update{Type}Data`
3. Ensure element cache includes `data-overlay-id`

## Performance Considerations

### 1. Use Element Caching
Always work with cached elements from `overlayElementCache`, never search entire DOM.

### 2. Minimize Template Processing
Only process templates when sourceData is available and content contains `{`.

### 3. Efficient DOM Updates
Only update DOM when content actually changes, return false otherwise.

### 4. Batch Operations
If multiple elements need updating, batch DOM operations to minimize reflows.

## Future Overlay Types

When implementing new overlay types, follow this checklist:

- [ ] Create {Type}OverlayRenderer class
- [ ] Implement static render() method
- [ ] Implement static update{Type}Data() method
- [ ] Add SystemsManager access for DataSource integration
- [ ] Implement template processing for initial render
- [ ] Add overlay type to AdvancedRenderer.renderOverlay()
- [ ] Add overlay type to AdvancedRenderer.updateOverlayData()
- [ ] Register in BaseOverlayUpdater._registerUpdaters()
- [ ] Update _hasTemplateContent() if using custom properties
- [ ] Add error handling and logging
- [ ] Test initial rendering, template processing, and dynamic updates

Following this guide ensures consistent behavior, proper DataSource integration, and maintainable code across all overlay types.