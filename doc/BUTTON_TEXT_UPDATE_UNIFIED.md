# Button Text Update - Unified Architecture

## Problem Statement
Button overlays can have multiple text fields that need to update when datasource values change:
- **Legacy fields**: `label` (top), `content` (bottom)
- **New format**: `texts` array with arbitrary number of fields
- **Issue**: Only the `content` field was updating, `label` was ignored

## Root Cause
The `updateButton()` method had **two separate code paths**:
1. ✅ `config.texts` array → iterate and update each field
2. ❌ Legacy fields → hardcoded to only update `textType="value"` (content), ignoring label

## Solution: Unified Update Mechanism

### Architecture Decision
**Always normalize to texts array internally**, mirroring the rendering approach.

### Implementation (ButtonRenderer.js ~line 1164)

```javascript
updateButton(buttonElement, config, sourceData) {
  // ✅ UNIFIED: Normalize legacy OR texts array to common format
  const buttonStyle = this._resolveButtonStyle(config, {}, {});
  const normalizedTexts = this._normalizeTextsConfiguration(config, buttonStyle);

  // Update ALL text fields (legacy label/content + texts array items)
  let anyUpdated = false;

  normalizedTexts.forEach((textConfig, index) => {
    // Try to find by index (texts array) OR by type (legacy)
    let textGroup = buttonElement.querySelector(`[data-button-text-index="${index}"]`);

    if (!textGroup && textConfig.textType) {
      textGroup = buttonElement.querySelector(`[data-button-text-type="${textConfig.textType}"]`);
    }

    // Resolve templates and update DOM
    const resolvedContent = this._resolveCellContent(rawContent, sourceData);
    textElement.textContent = this._escapeXml(newContent);
    anyUpdated = true;
  });

  return anyUpdated;
}
```

### Key Benefits

1. **Single Code Path**: No more duplicate logic for legacy vs. texts array
2. **Consistent Behavior**: All text fields update using the same mechanism
3. **Extensible**: Adding new text field types requires no update logic changes
4. **Maintainable**: Leverages existing `_normalizeTextsConfiguration()` used during rendering

### DOM Structure

**Rendering** (line ~329):
```html
<g data-button-text-index="0"
   data-button-text-type="label"
   data-button-id="btn_1">
  <text>{{entity.state}}</text>
</g>

<g data-button-text-index="1"
   data-button-text-type="value"
   data-button-id="btn_1">
  <text>{{entity.attributes.temp}}°</text>
</g>
```

**Update Logic**:
1. Try `data-button-text-index="${index}"` (texts array)
2. Fallback to `data-button-text-type="${textType}"` (legacy)
3. Resolve template with current datasource values
4. Update DOM while preserving text-anchor/dominant-baseline attributes

### What This Fixes

✅ Button `label` field now updates with datasource changes
✅ Button `content` field still updates (no regression)
✅ Button `texts` array fields all update correctly
✅ Mixed configurations (label + texts array) work correctly
✅ Template processing consistent across all field types

### Testing Scenarios

1. **Legacy button**:
   ```yaml
   label: "{{sensor.state}}"
   content: "{{sensor.attributes.value}}"
   ```
   Both fields update ✅

2. **Texts array button**:
   ```yaml
   texts:
     - content: "{{sensor.state}}"
       position: "center-top"
     - content: "{{sensor.attributes.value}}"
       position: "center-bottom"
     - content: "Custom: {{sensor.attributes.custom}}"
       position: "left"
   ```
   All 3 fields update ✅

3. **Mixed (not recommended but supported)**:
   ```yaml
   label: "{{sensor.state}}"
   texts:
     - content: "{{sensor.attributes.value}}"
   ```
   Both fields update ✅

### Related Code

- **Normalization**: `_normalizeTextsConfiguration()` (line ~199)
  - Converts legacy label/content → texts array with textType markers
  - Preserves `_originalContent` for template resolution

- **Rendering**: `renderButtonTexts()` (line ~266)
  - Renders all text fields with both index and type attributes
  - Already unified - update logic now matches

- **Template Resolution**: `_resolveCellContent()` (line ~1448)
  - Processes datasource templates with current values
  - Shared across all text field types

### Future Enhancements

- Consider removing `_updateButtonTextsArray()` method (now redundant)
- Add config validation to warn about mixed legacy + texts array usage
- Optimize querySelector calls with caching for large button counts
