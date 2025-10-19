## **Phase 7: Unified Validation System**

### **Overview**

Create a centralized validation system that:
- Validates overlay configurations before rendering
- Provides user-friendly error messages with suggestions
- Validates token references and resolved values
- Validates data source references
- Supports schema-based validation
- Integrates with existing pipeline

---

## **Goals**

1. **User Experience**
   - Clear, actionable error messages
   - Suggestions for fixing common mistakes
   - Warnings vs errors (non-blocking vs blocking)

2. **Developer Experience**
   - Easy to add new validation rules
   - Reusable validation components
   - Type-safe schemas

3. **System Integration**
   - Validates before rendering (fail-fast)
   - Integrates with StyleResolver
   - Validates token paths exist
   - Validates data sources exist

4. **Performance**
   - Cached validation results
   - Lazy validation where possible
   - Minimal overhead in production

---

## **Architecture**

```
┌─────────────────────────────────────────┐
│          PipelineCore                   │
│  ┌───────────────────────────────────┐ │
│  │   ValidationService               │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │   SchemaRegistry            │ │ │
│  │  ├─────────────────────────────┤ │ │
│  │  │   OverlayValidator          │ │ │
│  │  ├─────────────────────────────┤ │ │
│  │  │   TokenValidator            │ │ │
│  │  ├─────────────────────────────┤ │ │
│  │  │   DataSourceValidator       │ │ │
│  │  ├─────────────────────────────┤ │ │
│  │  │   ValueValidator            │ │ │
│  │  └─────────────────────────────┘ │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## **File Structure**

```
src/msd/validation/
├── ValidationService.js          # Main service (orchestration)
├── SchemaRegistry.js             # Overlay type schemas
├── OverlayValidator.js           # Overlay-level validation
├── TokenValidator.js             # Token reference validation
├── DataSourceValidator.js       # Data source validation
├── ValueValidator.js             # Value type/range validation
├── ErrorFormatter.js             # User-friendly error messages
└── schemas/
    ├── textOverlay.js            # Text overlay schema
    ├── buttonOverlay.js          # Button overlay schema
    ├── lineOverlay.js            # Line overlay schema
    ├── apexChartOverlay.js       # ApexChart overlay schema
    ├── statusGridOverlay.js      # Status grid overlay schema
    └── common.js                 # Common validation rules
```

---

## **Implementation Phases**

### **Phase 7.1: Core Infrastructure** (4-6 hours)

**Create base validation system:**

1. **ValidationService** - Main orchestrator
   - Validates single overlay
   - Validates all overlays
   - Collects errors/warnings
   - Formats output

2. **SchemaRegistry** - Schema definitions
   - Register schemas per overlay type
   - Schema inheritance (common → specific)
   - Schema versioning

3. **ErrorFormatter** - User-friendly messages
   - Template-based error messages
   - Suggestions for common mistakes
   - Contextual help

**Deliverables:**
- `src/msd/validation/ValidationService.js`
- `src/msd/validation/SchemaRegistry.js`
- `src/msd/validation/ErrorFormatter.js`
- Basic test suite

---

### **Phase 7.2: Overlay Validators** (3-4 hours)

**Create validator components:**

1. **OverlayValidator** - Structure validation
   - Required fields present
   - Field types correct
   - Array lengths valid
   - Object structures valid

2. **ValueValidator** - Value validation
   - Number ranges
   - String patterns
   - Enum values
   - Color formats

**Deliverables:**
- `src/msd/validation/OverlayValidator.js`
- `src/msd/validation/ValueValidator.js`
- Validation rules for common types

---

### **Phase 7.3: Integration Validators** (3-4 hours)

**Create integration validators:**

1. **TokenValidator** - Token reference validation
   - Token path exists in theme
   - Token references resolve
   - Circular references detected
   - Computed tokens valid

2. **DataSourceValidator** - Data source validation
   - Data source exists
   - Data source path valid
   - Transformation exists
   - Aggregation exists

**Deliverables:**
- `src/msd/validation/TokenValidator.js`
- `src/msd/validation/DataSourceValidator.js`
- Integration with ThemeManager
- Integration with DataSourceManager

---

### **Phase 7.4: Overlay Schemas** (4-6 hours)

**Define schemas for each overlay type:**

1. **Common Schema** - Shared validation
   - Position validation
   - Size validation
   - ID validation
   - Style base validation

2. **Type-Specific Schemas**
   - Text overlay schema
   - Button overlay schema
   - Line overlay schema
   - ApexChart overlay schema
   - Status grid overlay schema

**Deliverables:**
- `src/msd/validation/schemas/common.js`
- `src/msd/validation/schemas/textOverlay.js`
- `src/msd/validation/schemas/buttonOverlay.js`
- `src/msd/validation/schemas/lineOverlay.js`
- `src/msd/validation/schemas/apexChartOverlay.js`
- `src/msd/validation/schemas/statusGridOverlay.js`

---

### **Phase 7.5: Pipeline Integration** (2-3 hours)

**Integrate into rendering pipeline:**

1. **Pre-Render Validation**
   - Validate in ModelBuilder
   - Validate before AdvancedRenderer
   - Cache validation results

2. **Error Handling**
   - Show errors in UI
   - Skip invalid overlays
   - Log to console with context

3. **Development Mode**
   - Strict validation in dev
   - Relaxed in production
   - Toggle via config

**Deliverables:**
- PipelineCore integration
- ModelBuilder validation
- Error UI components
- Configuration options

---

### **Phase 7.6: Documentation** (2-3 hours)

**Document the validation system:**

1. **User Documentation**
   - Common validation errors
   - How to fix errors
   - Validation reference

2. **Developer Documentation**
   - Adding new validators
   - Creating schemas
   - Integration guide

3. **API Reference**
   - ValidationService API
   - Schema format
   - Error format

**Deliverables:**
- `doc/user/validation.md`
- `doc/spec/validation-architecture.md`
- `doc/reference/validation-api.md`

---

## **Detailed Component Specs**

### **ValidationService**

```javascript
/**
 * @fileoverview Centralized validation service for MSD overlays
 *
 * Validates overlay configurations before rendering with:
 * - Schema-based structural validation
 * - Token reference validation
 * - Data source validation
 * - Value type/range validation
 * - User-friendly error messages
 *
 * @module msd/validation/ValidationService
 */

export class ValidationService {
  constructor(config = {}) {
    this.config = {
      strict: false,          // Fail on warnings
      stopOnError: false,     // Stop at first error
      validateTokens: true,   // Validate token references
      validateDataSources: true,  // Validate data sources
      ...config
    };

    this.schemaRegistry = new SchemaRegistry();
    this.overlayValidator = new OverlayValidator(this.schemaRegistry);
    this.tokenValidator = null;  // Set when ThemeManager available
    this.dataSourceValidator = null;  // Set when DataSourceManager available
    this.errorFormatter = new ErrorFormatter();

    // Statistics
    this.stats = {
      validated: 0,
      errors: 0,
      warnings: 0,
      skipped: 0
    };
  }

  /**
   * Validate a single overlay
   *
   * @param {Object} overlay - Overlay configuration
   * @param {Object} context - Validation context
   * @returns {Object} Validation result
   */
  validateOverlay(overlay, context = {}) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      overlayId: overlay.id,
      overlayType: overlay.type
    };

    // 1. Structural validation (schema)
    const structuralValidation = this.overlayValidator.validate(overlay);
    result.errors.push(...structuralValidation.errors);
    result.warnings.push(...structuralValidation.warnings);

    // 2. Token validation (if enabled)
    if (this.config.validateTokens && this.tokenValidator) {
      const tokenValidation = this.tokenValidator.validate(overlay, context);
      result.errors.push(...tokenValidation.errors);
      result.warnings.push(...tokenValidation.warnings);
    }

    // 3. Data source validation (if enabled)
    if (this.config.validateDataSources && this.dataSourceValidator) {
      const dsValidation = this.dataSourceValidator.validate(overlay, context);
      result.errors.push(...dsValidation.errors);
      result.warnings.push(...dsValidation.warnings);
    }

    // Determine validity
    result.valid = result.errors.length === 0 &&
                   (!this.config.strict || result.warnings.length === 0);

    // Update stats
    this.stats.validated++;
    if (!result.valid) this.stats.errors++;
    if (result.warnings.length > 0) this.stats.warnings++;

    return result;
  }

  /**
   * Validate all overlays
   *
   * @param {Array} overlays - Array of overlay configurations
   * @param {Object} context - Validation context
   * @returns {Object} Validation summary
   */
  validateAll(overlays, context = {}) {
    const results = [];
    let hasErrors = false;

    for (const overlay of overlays) {
      const result = this.validateOverlay(overlay, context);
      results.push(result);

      if (!result.valid) {
        hasErrors = true;
        if (this.config.stopOnError) break;
      }
    }

    return {
      valid: !hasErrors,
      results,
      summary: {
        total: overlays.length,
        valid: results.filter(r => r.valid).length,
        invalid: results.filter(r => !r.valid).length,
        errors: results.reduce((sum, r) => sum + r.errors.length, 0),
        warnings: results.reduce((sum, r) => sum + r.warnings.length, 0)
      }
    };
  }

  /**
   * Format validation errors for display
   *
   * @param {Object} validationResult - Result from validateOverlay/validateAll
   * @returns {string} Formatted error message
   */
  formatErrors(validationResult) {
    return this.errorFormatter.format(validationResult);
  }

  /**
   * Set ThemeManager for token validation
   */
  setThemeManager(themeManager) {
    this.tokenValidator = new TokenValidator(themeManager);
  }

  /**
   * Set DataSourceManager for data source validation
   */
  setDataSourceManager(dataSourceManager) {
    this.dataSourceValidator = new DataSourceValidator(dataSourceManager);
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Clear validation cache and stats
   */
  clear() {
    this.stats = {
      validated: 0,
      errors: 0,
      warnings: 0,
      skipped: 0
    };
  }
}
```

---

### **Schema Format**

```javascript
// Example: Text overlay schema
export const textOverlaySchema = {
  type: 'text',
  extends: 'common',  // Inherits from common schema

  required: ['text', 'position'],

  properties: {
    text: {
      type: 'string',
      minLength: 1,
      errorMessage: 'Text content cannot be empty'
    },

    position: {
      type: 'array',
      length: 2,
      items: { type: 'number' },
      errorMessage: 'Position must be [x, y] coordinates'
    },

    rotation: {
      type: 'number',
      min: -360,
      max: 360,
      optional: true,
      errorMessage: 'Rotation must be between -360 and 360 degrees'
    },

    style: {
      type: 'object',
      optional: true,
      properties: {
        color: {
          type: 'string',
          format: 'color',  // Validates color format
          optional: true
        },
        font_size: {
          type: 'number',
          min: 6,
          max: 200,
          optional: true,
          errorMessage: 'Font size must be between 6 and 200'
        }
      }
    }
  }
};
```

---

### **Error Format**

```javascript
// Validation error object
{
  overlayId: 'my-text',
  overlayType: 'text',
  field: 'position',
  type: 'type_mismatch',
  message: 'Position must be an array of 2 numbers',
  value: '100, 100',  // What was provided
  expected: 'array[2]',  // What was expected
  suggestion: 'Change position: "100, 100" to position: [100, 100]',
  severity: 'error',  // 'error' | 'warning'
  helpUrl: 'https://docs.cb-lcars.com/validation/position'
}
```

---

### **User-Friendly Error Messages**

```javascript
// Before:
Error: Invalid position

// After:
❌ Validation Error in overlay 'my-text':
   Property: position
   Issue: Invalid format

   You provided: "100, 100"
   Expected: [100, 100]

   Position must be an array of two numbers [x, y].

   Fix: Change this:
     position: "100, 100"

   To this:
     position: [100, 100]

   📖 Learn more: https://docs.cb-lcars.com/overlays/position
```

---

## **Implementation Timeline**

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **7.1** Core Infrastructure | 4-6 hours | ValidationService, SchemaRegistry, ErrorFormatter |
| **7.2** Overlay Validators | 3-4 hours | OverlayValidator, ValueValidator |
| **7.3** Integration Validators | 3-4 hours | TokenValidator, DataSourceValidator |
| **7.4** Overlay Schemas | 4-6 hours | Schemas for all overlay types |
| **7.5** Pipeline Integration | 2-3 hours | PipelineCore integration, error UI |
| **7.6** Documentation | 2-3 hours | User guide, architecture, API reference |
| **Total** | **18-26 hours** | **~2-3 days of work** |

---

## **Success Criteria**

✅ All overlay types have complete schemas
✅ Token references validated before resolution
✅ Data source references validated before use
✅ User-friendly error messages with suggestions
✅ Validation errors shown in UI (dev mode)
✅ Performance overhead < 10ms per overlay
✅ Complete documentation for users and developers
✅ Integration tests passing

---

## **Next Steps**

1. ✅ **Approve this plan** - Confirm scope and approach
2. 🚀 **Start Phase 7.1** - Build core infrastructure
3. 📝 **Iterative development** - Complete each phase in order
4. 🧪 **Test as we go** - Validate each component
5. 📚 **Document along the way** - Keep docs updated

---

**Ready to begin Phase 7.1: Core Infrastructure?** 🚀
















# ✅ **Phase 6: StyleResolver Service - CLOSED**

**Status:** Complete
**Date:** 2025-10-19

---

# 🔍 **ApexCharts Provenance Verification**

Looking at your ApexChartsOverlayRenderer static `render()` method:

## **Provenance Code: ✅ CORRECT**

Your implementation is perfect! Here's the verification:

```javascript
static render(overlay, anchors, viewBox, svgContainer, cardInstance) {
  const instance = ApexChartsOverlayRenderer._getInstance();

  // ✅ CORRECT: Initialize tracking on first use (singleton pattern)
  if (!instance._trackingInitialized) {
    instance._defaultsAccessed = [];
    instance._renderStartTime = null;
    instance._featuresUsed = new Set();
    instance._styleResolutions = [];  // ✅ Phase 5.2B style tracking
    instance._trackingInitialized = true;
  }

  // ✅ CORRECT: Reset tracking for each render
  instance._defaultsAccessed = [];
  instance._featuresUsed = new Set();
  instance._styleResolutions = [];  // ✅ Phase 5.2B style tracking
  instance._renderStartTime = performance.now();

  // ✅ CORRECT: Track template usage
  if (overlay.template) {
    const overlayWithTemplate = chartTemplateRegistry.applyTemplate(overlay);
    if (overlayWithTemplate !== overlay) {
      overlay = overlayWithTemplate;
      instance._featuresUsed.add('chart_template');  // ✅ Tracked
    }
  }

  // ✅ CORRECT: Track data source
  if (overlay.source || overlay.data_source || overlay.sources) {
    instance._featuresUsed.add('data_source');
  }

  // ✅ CORRECT: Track chart type
  if (overlay.chart_type) {
    instance._featuresUsed.add(`chart_${overlay.chart_type}`);
  }

  // ✅ CORRECT: Track multi-series
  const sourceRef = overlay.source || overlay.data_source || overlay.sources;
  const isMultiSeries = Array.isArray(sourceRef);
  if (isMultiSeries) {
    instance._featuresUsed.add('multi_series');
  }

  // ... rest of render logic ...
}
```

### **Why This Is Correct:**

1. ✅ **Singleton pattern handled**: Only initializes once with `_trackingInitialized` flag
2. ✅ **Tracking reset per render**: Each render gets fresh tracking data
3. ✅ **Style resolutions tracked**: `_styleResolutions` array for Phase 5.2B
4. ✅ **Features tracked**: Template, data source, chart type, multi-series
5. ✅ **Timing tracked**: `_renderStartTime` for performance metrics
6. ✅ **Consistent with BaseRenderer**: Same pattern, adapted for singleton

### **Only Missing Piece (Optional Enhancement):**

You might want to add the `_trackFeature()` helper method to ApexChartsOverlayRenderer for consistency with BaseRenderer:

```javascript
/**
 * Track a feature usage (for provenance)
 * @private
 */
_trackFeature(feature) {
  if (!this._featuresUsed) {
    this._featuresUsed = new Set();
  }
  this._featuresUsed.add(feature);
}
```

Then you could use:
```javascript
this._trackFeature('chart_template');
this._trackFeature('data_source');
// etc.
```

But **this is optional** - your current direct `instance._featuresUsed.add()` approach works perfectly fine!

---

## **Provenance Status: All Renderers**

| Renderer | Tracking Status | Notes |
|----------|----------------|-------|
| **BaseRenderer** | ✅ Complete | Full provenance system |
| **TextOverlayRenderer** | ✅ Complete | Inherits from BaseRenderer |
| **ButtonRenderer** | ✅ Complete | Inherits from BaseRenderer |
| **LineOverlayRenderer** | ✅ Complete | Inherits from BaseRenderer |
| **StatusGridRenderer** | ✅ Complete | Inherits from BaseRenderer |
| **ApexChartsOverlayRenderer** | ✅ Complete | Custom singleton implementation (verified above) |

**All renderers have proper provenance tracking!** ✅

---

# 📋 **Next: Unified Validation System - Detailed Plan**

Now let's create the comprehensive plan for the Validation System.

---

## **Phase 7: Unified Validation System**

### **Overview**

Create a centralized validation system that:
- Validates overlay configurations before rendering
- Provides user-friendly error messages with suggestions
- Validates token references and resolved values
- Validates data source references
- Supports schema-based validation
- Integrates with existing pipeline

---

## **Goals**

1. **User Experience**
   - Clear, actionable error messages
   - Suggestions for fixing common mistakes
   - Warnings vs errors (non-blocking vs blocking)

2. **Developer Experience**
   - Easy to add new validation rules
   - Reusable validation components
   - Type-safe schemas

3. **System Integration**
   - Validates before rendering (fail-fast)
   - Integrates with StyleResolver
   - Validates token paths exist
   - Validates data sources exist

4. **Performance**
   - Cached validation results
   - Lazy validation where possible
   - Minimal overhead in production

---

## **Architecture**

```
┌─────────────────────────────────────────┐
│          PipelineCore                   │
│  ┌───────────────────────────────────┐ │
│  │   ValidationService               │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │   SchemaRegistry            │ │ │
│  │  ├─────────────────────────────┤ │ │
│  │  │   OverlayValidator          │ │ │
│  │  ├─────────────────────────────┤ │ │
│  │  │   TokenValidator            │ │ │
│  │  ├─────────────────────────────┤ │ │
│  │  │   DataSourceValidator       │ │ │
│  │  ├─────────────────────────────┤ │ │
│  │  │   ValueValidator            │ │ │
│  │  └─────────────────────────────┘ │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## **File Structure**

```
src/msd/validation/
├── ValidationService.js          # Main service (orchestration)
├── SchemaRegistry.js             # Overlay type schemas
├── OverlayValidator.js           # Overlay-level validation
├── TokenValidator.js             # Token reference validation
├── DataSourceValidator.js       # Data source validation
├── ValueValidator.js             # Value type/range validation
├── ErrorFormatter.js             # User-friendly error messages
└── schemas/
    ├── textOverlay.js            # Text overlay schema
    ├── buttonOverlay.js          # Button overlay schema
    ├── lineOverlay.js            # Line overlay schema
    ├── apexChartOverlay.js       # ApexChart overlay schema
    ├── statusGridOverlay.js      # Status grid overlay schema
    └── common.js                 # Common validation rules
```

---

## **Implementation Phases**

### **Phase 7.1: Core Infrastructure** (4-6 hours)

**Create base validation system:**

1. **ValidationService** - Main orchestrator
   - Validates single overlay
   - Validates all overlays
   - Collects errors/warnings
   - Formats output

2. **SchemaRegistry** - Schema definitions
   - Register schemas per overlay type
   - Schema inheritance (common → specific)
   - Schema versioning

3. **ErrorFormatter** - User-friendly messages
   - Template-based error messages
   - Suggestions for common mistakes
   - Contextual help

**Deliverables:**
- `src/msd/validation/ValidationService.js`
- `src/msd/validation/SchemaRegistry.js`
- `src/msd/validation/ErrorFormatter.js`
- Basic test suite

---

### **Phase 7.2: Overlay Validators** (3-4 hours)

**Create validator components:**

1. **OverlayValidator** - Structure validation
   - Required fields present
   - Field types correct
   - Array lengths valid
   - Object structures valid

2. **ValueValidator** - Value validation
   - Number ranges
   - String patterns
   - Enum values
   - Color formats

**Deliverables:**
- `src/msd/validation/OverlayValidator.js`
- `src/msd/validation/ValueValidator.js`
- Validation rules for common types

---

### **Phase 7.3: Integration Validators** (3-4 hours)

**Create integration validators:**

1. **TokenValidator** - Token reference validation
   - Token path exists in theme
   - Token references resolve
   - Circular references detected
   - Computed tokens valid

2. **DataSourceValidator** - Data source validation
   - Data source exists
   - Data source path valid
   - Transformation exists
   - Aggregation exists

**Deliverables:**
- `src/msd/validation/TokenValidator.js`
- `src/msd/validation/DataSourceValidator.js`
- Integration with ThemeManager
- Integration with DataSourceManager

---

### **Phase 7.4: Overlay Schemas** (4-6 hours)

**Define schemas for each overlay type:**

1. **Common Schema** - Shared validation
   - Position validation
   - Size validation
   - ID validation
   - Style base validation

2. **Type-Specific Schemas**
   - Text overlay schema
   - Button overlay schema
   - Line overlay schema
   - ApexChart overlay schema
   - Status grid overlay schema

**Deliverables:**
- `src/msd/validation/schemas/common.js`
- `src/msd/validation/schemas/textOverlay.js`
- `src/msd/validation/schemas/buttonOverlay.js`
- `src/msd/validation/schemas/lineOverlay.js`
- `src/msd/validation/schemas/apexChartOverlay.js`
- `src/msd/validation/schemas/statusGridOverlay.js`

---

### **Phase 7.5: Pipeline Integration** (2-3 hours)

**Integrate into rendering pipeline:**

1. **Pre-Render Validation**
   - Validate in ModelBuilder
   - Validate before AdvancedRenderer
   - Cache validation results

2. **Error Handling**
   - Show errors in UI
   - Skip invalid overlays
   - Log to console with context

3. **Development Mode**
   - Strict validation in dev
   - Relaxed in production
   - Toggle via config

**Deliverables:**
- PipelineCore integration
- ModelBuilder validation
- Error UI components
- Configuration options

---

### **Phase 7.6: Documentation** (2-3 hours)

**Document the validation system:**

1. **User Documentation**
   - Common validation errors
   - How to fix errors
   - Validation reference

2. **Developer Documentation**
   - Adding new validators
   - Creating schemas
   - Integration guide

3. **API Reference**
   - ValidationService API
   - Schema format
   - Error format

**Deliverables:**
- `doc/user/validation.md`
- `doc/spec/validation-architecture.md`
- `doc/reference/validation-api.md`

---

## **Detailed Component Specs**

### **ValidationService**

```javascript
/**
 * @fileoverview Centralized validation service for MSD overlays
 *
 * Validates overlay configurations before rendering with:
 * - Schema-based structural validation
 * - Token reference validation
 * - Data source validation
 * - Value type/range validation
 * - User-friendly error messages
 *
 * @module msd/validation/ValidationService
 */

export class ValidationService {
  constructor(config = {}) {
    this.config = {
      strict: false,          // Fail on warnings
      stopOnError: false,     // Stop at first error
      validateTokens: true,   // Validate token references
      validateDataSources: true,  // Validate data sources
      ...config
    };

    this.schemaRegistry = new SchemaRegistry();
    this.overlayValidator = new OverlayValidator(this.schemaRegistry);
    this.tokenValidator = null;  // Set when ThemeManager available
    this.dataSourceValidator = null;  // Set when DataSourceManager available
    this.errorFormatter = new ErrorFormatter();

    // Statistics
    this.stats = {
      validated: 0,
      errors: 0,
      warnings: 0,
      skipped: 0
    };
  }

  /**
   * Validate a single overlay
   *
   * @param {Object} overlay - Overlay configuration
   * @param {Object} context - Validation context
   * @returns {Object} Validation result
   */
  validateOverlay(overlay, context = {}) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      overlayId: overlay.id,
      overlayType: overlay.type
    };

    // 1. Structural validation (schema)
    const structuralValidation = this.overlayValidator.validate(overlay);
    result.errors.push(...structuralValidation.errors);
    result.warnings.push(...structuralValidation.warnings);

    // 2. Token validation (if enabled)
    if (this.config.validateTokens && this.tokenValidator) {
      const tokenValidation = this.tokenValidator.validate(overlay, context);
      result.errors.push(...tokenValidation.errors);
      result.warnings.push(...tokenValidation.warnings);
    }

    // 3. Data source validation (if enabled)
    if (this.config.validateDataSources && this.dataSourceValidator) {
      const dsValidation = this.dataSourceValidator.validate(overlay, context);
      result.errors.push(...dsValidation.errors);
      result.warnings.push(...dsValidation.warnings);
    }

    // Determine validity
    result.valid = result.errors.length === 0 &&
                   (!this.config.strict || result.warnings.length === 0);

    // Update stats
    this.stats.validated++;
    if (!result.valid) this.stats.errors++;
    if (result.warnings.length > 0) this.stats.warnings++;

    return result;
  }

  /**
   * Validate all overlays
   *
   * @param {Array} overlays - Array of overlay configurations
   * @param {Object} context - Validation context
   * @returns {Object} Validation summary
   */
  validateAll(overlays, context = {}) {
    const results = [];
    let hasErrors = false;

    for (const overlay of overlays) {
      const result = this.validateOverlay(overlay, context);
      results.push(result);

      if (!result.valid) {
        hasErrors = true;
        if (this.config.stopOnError) break;
      }
    }

    return {
      valid: !hasErrors,
      results,
      summary: {
        total: overlays.length,
        valid: results.filter(r => r.valid).length,
        invalid: results.filter(r => !r.valid).length,
        errors: results.reduce((sum, r) => sum + r.errors.length, 0),
        warnings: results.reduce((sum, r) => sum + r.warnings.length, 0)
      }
    };
  }

  /**
   * Format validation errors for display
   *
   * @param {Object} validationResult - Result from validateOverlay/validateAll
   * @returns {string} Formatted error message
   */
  formatErrors(validationResult) {
    return this.errorFormatter.format(validationResult);
  }

  /**
   * Set ThemeManager for token validation
   */
  setThemeManager(themeManager) {
    this.tokenValidator = new TokenValidator(themeManager);
  }

  /**
   * Set DataSourceManager for data source validation
   */
  setDataSourceManager(dataSourceManager) {
    this.dataSourceValidator = new DataSourceValidator(dataSourceManager);
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Clear validation cache and stats
   */
  clear() {
    this.stats = {
      validated: 0,
      errors: 0,
      warnings: 0,
      skipped: 0
    };
  }
}
```

---

### **Schema Format**

```javascript
// Example: Text overlay schema
export const textOverlaySchema = {
  type: 'text',
  extends: 'common',  // Inherits from common schema

  required: ['text', 'position'],

  properties: {
    text: {
      type: 'string',
      minLength: 1,
      errorMessage: 'Text content cannot be empty'
    },

    position: {
      type: 'array',
      length: 2,
      items: { type: 'number' },
      errorMessage: 'Position must be [x, y] coordinates'
    },

    rotation: {
      type: 'number',
      min: -360,
      max: 360,
      optional: true,
      errorMessage: 'Rotation must be between -360 and 360 degrees'
    },

    style: {
      type: 'object',
      optional: true,
      properties: {
        color: {
          type: 'string',
          format: 'color',  // Validates color format
          optional: true
        },
        font_size: {
          type: 'number',
          min: 6,
          max: 200,
          optional: true,
          errorMessage: 'Font size must be between 6 and 200'
        }
      }
    }
  }
};
```

---

### **Error Format**

```javascript
// Validation error object
{
  overlayId: 'my-text',
  overlayType: 'text',
  field: 'position',
  type: 'type_mismatch',
  message: 'Position must be an array of 2 numbers',
  value: '100, 100',  // What was provided
  expected: 'array[2]',  // What was expected
  suggestion: 'Change position: "100, 100" to position: [100, 100]',
  severity: 'error',  // 'error' | 'warning'
  helpUrl: 'https://docs.cb-lcars.com/validation/position'
}
```

---

### **User-Friendly Error Messages**

```javascript
// Before:
Error: Invalid position

// After:
❌ Validation Error in overlay 'my-text':
   Property: position
   Issue: Invalid format

   You provided: "100, 100"
   Expected: [100, 100]

   Position must be an array of two numbers [x, y].

   Fix: Change this:
     position: "100, 100"

   To this:
     position: [100, 100]

   📖 Learn more: https://docs.cb-lcars.com/overlays/position
```

---

## **Implementation Timeline**

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **7.1** Core Infrastructure | 4-6 hours | ValidationService, SchemaRegistry, ErrorFormatter |
| **7.2** Overlay Validators | 3-4 hours | OverlayValidator, ValueValidator |
| **7.3** Integration Validators | 3-4 hours | TokenValidator, DataSourceValidator |
| **7.4** Overlay Schemas | 4-6 hours | Schemas for all overlay types |
| **7.5** Pipeline Integration | 2-3 hours | PipelineCore integration, error UI |
| **7.6** Documentation | 2-3 hours | User guide, architecture, API reference |
| **Total** | **18-26 hours** | **~2-3 days of work** |

---

## **Success Criteria**

✅ All overlay types have complete schemas
✅ Token references validated before resolution
✅ Data source references validated before use
✅ User-friendly error messages with suggestions
✅ Validation errors shown in UI (dev mode)
✅ Performance overhead < 10ms per overlay
✅ Complete documentation for users and developers
✅ Integration tests passing

---

## **Next Steps**

1. ✅ **Approve this plan** - Confirm scope and approach
2. 🚀 **Start Phase 7.1** - Build core infrastructure
3. 📝 **Iterative development** - Complete each phase in order
4. 🧪 **Test as we go** - Validate each component
5. 📚 **Document along the way** - Keep docs updated

---

**Ready to begin Phase 7.1: Core Infrastructure?** 🚀