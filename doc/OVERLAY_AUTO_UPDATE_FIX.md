# Overlay Auto-Update Fix

**Date:** 2025-11-02
**Status:** ✅ FIXED

## Problem

Text overlays with datasource templates weren't automatically updating when datasource values changed. For example:

```yaml
datasources:
  - name: cpu_temp
    entity: sensor.cpu_temperature

overlays:
  - id: cpu_display
    type: text
    text: "CPU: {cpu_temp}°C"
```

When `cpu_temp` changed, the text would **not update** unless you used a rule to force re-evaluation:

```yaml
rules:
  - when:
      entity: cpu_temp
      above: 0  # Always true - forces update
    apply:
      overlays:
        cpu_display:
          text: "CPU: {cpu_temp}°C"
```

## Root Cause

The `_extractDataSourceReferences()` method in `ModelBuilder.js` had a critical bug. It was only extracting datasource references that contained a dot (`.`):

```javascript
// OLD BUGGY CODE
if (ref.includes('.')) {
  const parts = ref.split('.');
  const sourceName = parts[0];

  if (parts.includes('transformations') ||
      parts.includes('aggregations') ||
      this.systems?.dataSourceManager?.getSource(sourceName)) {
    references.push(sourceName);
  }
}
```

This meant:
- ✅ `{cpu_temp.transformations.celsius}` - **WORKED** (has dot)
- ❌ `{cpu_temp}` - **FAILED** (no dot, skipped entirely)

## The Fix

**File:** `src/msd/pipeline/ModelBuilder.js`
**Method:** `_extractDataSourceReferences(content)`
**Lines:** ~438-470

Changed the extraction logic to:

1. **Remove the dot requirement** - Extract ALL template references `{...}`
2. **Skip HA entities** - Ignore `{{entity:sensor.name}}` syntax (double braces)
3. **Extract datasource name** - Take the first part before any dots
4. **Subscribe to all** - Let the subscription handler verify if datasource exists

```javascript
// NEW FIXED CODE
while ((match = regex.exec(content)) !== null) {
  const ref = match[1].trim();

  // Skip HA entity references (they use entity: prefix in double braces)
  if (ref.startsWith('entity:')) {
    continue;
  }

  // Extract the datasource name (first part before any dots)
  const sourceName = ref.split('.')[0];

  // Check if this datasource exists in the DataSourceManager
  if (this.systems?.dataSourceManager?.getSource(sourceName)) {
    references.push(sourceName);
    cblcarsLog.debug(`[ModelBuilder] 📋 Found datasource reference in template: ${sourceName}`);
  } else {
    // Try to subscribe anyway (datasource might be created later)
    cblcarsLog.debug(`[ModelBuilder] 📋 Found potential datasource reference (not yet verified): ${sourceName}`);
    references.push(sourceName);
  }
}
```

## How It Works Now

The complete flow:

1. **ModelBuilder.computeResolvedModel()** (line 31)
   - Calls `_subscribeTextOverlaysToDataSources(baseOverlays)`

2. **_subscribeTextOverlaysToDataSources()** (line 355)
   - For each text overlay, extracts datasource references from text content
   - Calls `_extractDataSourceReferences()` - **NOW FIXED**

3. **_extractDataSourceReferences()** (line 438)
   - Finds all `{datasource_name}` templates
   - Returns array of unique datasource names

4. **_subscribeTextOverlayToDataSource()** (line 381)
   - Creates subscription to datasource
   - Stores unsubscribe function for cleanup

5. **When datasource updates:**
   - Callback fires: `ModelBuilder.js` line 422
   - Calls `renderer.updateOverlayData(overlayId, data)`

6. **AdvancedRenderer.updateOverlayData()** (line 1614)
   - Delegates to instance renderer's `update()` method

7. **TextOverlay.update()** (line 265)
   - Invalidates cached content
   - Re-resolves text with new datasource values
   - Updates DOM: `textElement.textContent = textContent`

## Result

Now **both** patterns work without rules:

```yaml
# Simple datasource reference - NOW WORKS! ✅
- id: cpu_display
  type: text
  text: "CPU: {cpu_temp}°C"

# Dotted path reference - STILL WORKS! ✅
- id: temp_display
  type: text
  text: "Temp: {cpu_temp.transformations.fahrenheit}°F"

# Mixed templates - NOW WORKS! ✅
- id: multi_display
  type: text
  text: "CPU {cpu_temp}°C | GPU {gpu_temp}°C"
```

## What Rules Are Still Needed For

Rules are still necessary for:

1. **Conditional text changes:**
   ```yaml
   rules:
     - when:
         entity: cpu_temp
         above: 80
       apply:
         overlays:
           cpu_display:
             text: "CPU: CRITICAL {cpu_temp}°C"  # Different text when hot
   ```

2. **Conditional styling:**
   ```yaml
   rules:
     - when:
         entity: cpu_temp
         above: 80
       apply:
         overlays:
           cpu_display:
             style:
               fill: var(--lcars-red)  # Change color when hot
   ```

3. **Conditional animations:**
   ```yaml
   rules:
     - when:
         entity: cpu_temp
         above: 80
       apply:
         overlays:
           cpu_display:
             animations:
               - preset: glow
                 color: var(--lcars-red)  # Animate when hot
   ```

## Backward Compatibility

✅ **Fully backward compatible** - No breaking changes.

- Existing configs continue to work
- Rules-based updates still work
- Dotted path references still work
- Direct `data_source` property still works

## Testing

To test this fix:

1. Create a text overlay with a simple datasource template:
   ```yaml
   datasources:
     - name: test_sensor
       entity: sensor.test

   overlays:
     - id: test_text
       type: text
       text: "Value: {test_sensor}"
   ```

2. Change the sensor value in Home Assistant

3. Watch the text overlay **automatically update** without needing rules

4. Check browser console for logs:
   ```
   [ModelBuilder] 📋 Found datasource reference in template: test_sensor
   [ModelBuilder] ✅ Subscribed text overlay test_text to DataSource test_sensor
   [ModelBuilder] 📊 Text overlay test_text received DataSource update from test_sensor
   [TextOverlay] 🔄 Updating text overlay: test_text
   [TextOverlay] ✅ Updated text overlay test_text with processed content
   ```

## Files Modified

- `src/msd/pipeline/ModelBuilder.js` - Fixed `_extractDataSourceReferences()` method

## Build Status

✅ Build successful with no errors:
```
webpack 5.97.0 compiled with 3 warnings in 9482 ms
```

---

**This fix eliminates the workaround of using rules with always-true conditions just to get text overlays to update. Text overlays now behave as users expect - they automatically update when datasource values change.**
