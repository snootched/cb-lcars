# Phase 2: Template Processing Audit

## Current State Analysis

### Template Processing Locations

#### 1. **DataSourceMixin.js** (Primary Template Processor)
**Lines:** 1-540
**Responsibilities:**
- MSD template processing: `{data_source.key:format}`
- HA template processing: `{{states('entity.id')}}`
- Unified template processing (mixed syntax)
- DataSource value resolution
- Number formatting

**Key Methods:**
- `resolveContent()` - Main entry point for content resolution
- `processEnhancedTemplateStrings()` - MSD templates (`{...}`)
- `processTemplateForInitialRender()` - Initial render with fallbacks
- `processUnifiedTemplateStrings()` - Mixed HA + MSD templates
- `_processHATemplates()` - HA templates (`{{...}}`)
- `applyNumberFormat()` - Format values with units

**Template Syntax Supported:**
- `{data_source}` - Basic DataSource reference
- `{data_source.transformation.key}` - Transformation access
- `{data_source.aggregation.key}` - Aggregation access
- `{data_source:format}` - With formatting (e.g., `.2f`, `int`)
- `{{states('entity.id')}}` - HA state function
- `{{state_attr('entity.id', 'attr')}}` - HA attribute function

#### 2. **MsdTemplateEngine.js** (HA Template Engine)
**Lines:** 1-400+
**Responsibilities:**
- Compile HA templates
- Extract entity dependencies
- Evaluate HA template functions
- Format values with filters

**Key Methods:**
- `compileTemplate()` - Parse and compile HA templates
- `evaluateTemplate()` - Execute compiled templates
- `parseTemplateExpression()` - Parse `{{...}}` expressions
- `getEntityState()` - Resolve entity states
- `formatValue()` - Apply filters (round, float, int, etc.)

**HA Functions Supported:**
- `states('entity.id')` - Get entity state
- `state_attr('entity.id', 'attr')` - Get entity attribute
- Filters: `round(n)`, `float`, `int`

#### 3. **OverlayUtils.js** (Simple Template Processor)
**Lines:** 118-130
**Responsibilities:**
- Basic key/value substitution
- No DataSource integration
- Used for simple string replacements

**Method:**
- `processTemplate(template, data)` - Basic `{key}` → `value` replacement

**Status:** Legacy, minimal usage, candidate for removal

#### 4. **ActionHelpers.js** (Action Template Processor)
**Lines:** 501-540
**Responsibilities:**
- Resolve action configuration templates
- Context-based substitution (cell.id, overlay.id, etc.)

**Templates Supported:**
- `{{cell.id}}`, `{{cell.row}}`, `{{cell.col}}`
- `{{overlay.id}}`, `{{overlay.type}}`

**Status:** Specialized for action configuration

### Template Usage Patterns

#### Text Overlays
**File:** `TextOverlayRenderer.js`
**Usage:** `DataSourceMixin.processTemplateForInitialRender()`
- Real-time entity state display
- DataSource value display
- Mixed HA + MSD templates

#### Status Grid Overlays
**File:** `BaseOverlayUpdater.js`, `StatusGridRenderer.js`
**Usage:** `DataSourceMixin.processEnhancedTemplateStrings()`
- Button labels with entity states
- Cell content with DataSource values
- Dynamic status display

#### ApexCharts Overlays
**File:** `ApexChartsOverlayRenderer.js`
**Usage:** Chart data fed from DataSources (no direct template processing)
- DataSources provide chart data
- No template syntax in chart config

#### Button Overlays
**File:** `ButtonOverlayRenderer.js`
**Usage:** `DataSourceMixin.resolveContent()`
- Button labels with templates
- Icon references
- State-based content

### Duplication Analysis

#### ❌ PROBLEM 1: Multiple Template Regex Patterns
**Locations:**
- `DataSourceMixin.js` - `/\{([^}]+)\}/g` (MSD templates)
- `DataSourceMixin.js` - `/\{\{([^}]+)\}\}/g` (HA templates - via MsdTemplateEngine)
- `OverlayUtils.js` - `/\{([^}]+)\}/g` (Simple templates)
- `ActionHelpers.js` - `/\{\{[^}]+\}\}/g` (Action templates)

**Impact:** Inconsistent parsing, maintenance burden

#### ❌ PROBLEM 2: Duplicate Format Parsing
**Locations:**
- `DataSourceMixin.applyNumberFormat()` - Full implementation with units
- `MsdTemplateEngine.formatValue()` - HA filter implementation

**Impact:** Different formatting behaviors, inconsistent results

#### ❌ PROBLEM 3: Multiple Entity Resolution Paths
**Locations:**
- `DataSourceMixin.resolveDataSourceContent()` - DataSource + entity
- `MsdTemplateEngine.getEntityState()` - Direct HASS state access
- `RulesEngine.getEntity()` - Rule evaluation entity access

**Impact:** Different fallback behaviors, potential state mismatch

#### ❌ PROBLEM 4: Template Detection Scattered
**Locations:**
- `DataSourceMixin._hasTemplateMarkers()` - Check for templates
- `BaseOverlayUpdater._hasTemplateContent()` - Overlay-level check
- Multiple inline `content.includes('{')` checks

**Impact:** Inconsistent detection, missed template opportunities

### Performance Concerns

#### Template Compilation
- ✅ `MsdTemplateEngine` has caching
- ❌ `DataSourceMixin` compiles on every render
- ❌ No cross-overlay template reuse

#### Entity Subscriptions
- ✅ `MsdTemplateEngine` can extract dependencies
- ❌ Not integrated with DataSource subscription system
- ❌ Overlays don't register template entity dependencies

### Known Issues

1. **cell_color vs color mismatch** - StatusGrid patches use different property names
2. **Template evaluation timing** - Some templates evaluated before DataSources ready
3. **Mixed syntax parsing** - HA `{{...}}` inside MSD `{...}` causes conflicts
4. **No template validation** - Syntax errors only caught at runtime

## Consolidation Goals

### 1. Unified Template Processor
Create `src/msd/utils/TemplateProcessor.js` with:
- Single regex pattern registry
- Unified parsing logic
- Consistent format handling
- Template caching
- Entity dependency extraction

### 2. Remove Duplicates
- ❌ Delete `OverlayUtils.processTemplate()` (unused/legacy)
- ❌ Merge `DataSourceMixin` template methods into `TemplateProcessor`
- ❌ Consolidate format parsing into single implementation
- ✅ Keep `MsdTemplateEngine` for HA-specific functions
- ✅ Keep `ActionHelpers` templates (specialized context)

### 3. Standardize API
All overlays should use consistent API:
```javascript
// BEFORE (scattered):
DataSourceMixin.processEnhancedTemplateStrings(content, 'TextRenderer')
DataSourceMixin.resolveContent(source, style, 'StatusGridRenderer')
OverlayUtils.processTemplate(template, data)

// AFTER (unified):
TemplateProcessor.process(content, context)
```

### 4. Integration Points
- `BaseOverlayUpdater` - Use TemplateProcessor for overlay updates
- `TextOverlayRenderer` - Use TemplateProcessor for text content
- `StatusGridRenderer` - Use TemplateProcessor for cell content
- `ButtonOverlayRenderer` - Use TemplateProcessor for button labels
- `ModelBuilder` - Use TemplateProcessor for dependency extraction

## Implementation Plan

### Step 1: Create TemplateProcessor (THIS PR)
- [ ] Create `src/msd/utils/TemplateProcessor.js`
- [ ] Move template regex patterns into constants
- [ ] Implement `extractReferences(content)` - get all template references
- [ ] Implement `hasTemplates(content)` - detect template markers
- [ ] Implement `process(content, context)` - unified processing
- [ ] Implement `extractEntityDependencies(content)` - for subscriptions
- [ ] Add comprehensive JSDoc

### Step 2: Integrate with DataSourceMixin
- [ ] Update `DataSourceMixin` to delegate to `TemplateProcessor`
- [ ] Keep `MsdTemplateEngine` integration for HA templates
- [ ] Remove duplicate format parsing
- [ ] Maintain backwards compatibility

### Step 3: Update Overlay Renderers
- [ ] `TextOverlayRenderer` - use TemplateProcessor
- [ ] `StatusGridRenderer` - use TemplateProcessor
- [ ] `ButtonOverlayRenderer` - use TemplateProcessor
- [ ] `BaseOverlayUpdater` - use TemplateProcessor for detection

### Step 4: Remove Legacy Code
- [ ] Delete `OverlayUtils.processTemplate()`
- [ ] Remove inline template detection
- [ ] Consolidate format parsing
- [ ] Update all references

### Step 5: Testing
- [ ] Test MSD templates: `{data_source.key:format}`
- [ ] Test HA templates: `{{states('entity.id')}}`
- [ ] Test mixed templates
- [ ] Test template detection
- [ ] Test entity dependency extraction
- [ ] Performance testing with caching

## Success Criteria

✅ Single source of truth for template processing
✅ Consistent template syntax across all overlays
✅ No duplicate regex patterns
✅ No duplicate format parsing
✅ Proper entity dependency extraction
✅ Template caching for performance
✅ All existing templates continue to work
✅ No breaking changes to user configs

## Next Phase Dependencies

Phase 3 (Overlay Runtime API) requires:
- ✅ Consistent template processing
- ✅ Known template entity dependencies
- ✅ Unified format handling
- ✅ Clear separation: templates vs direct values

This phase is **CRITICAL** for Phase 3 success!
