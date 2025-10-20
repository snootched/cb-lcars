/**
 * @fileoverview Value Validator - Type, range, and format validation with token resolution
 *
 * Validates individual values against schema constraints:
 * - Type checking (string, number, boolean, array, object)
 * - Range validation (min, max, length)
 * - Format validation (patterns, enums, custom formats)
 * - Array/object structure validation
 * - ✅ NEW: Design token resolution and validation
 * - ✅ NEW: Enhanced property format support
 *
 * @module msd/validation/ValueValidator
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Value Validator
 *
 * Validates individual values against schema constraints.
 * Enhanced with token resolution and enhanced property support.
 */
export class ValueValidator {
  constructor() {
    // ✅ NEW: ThemeManager for token resolution
    this.themeManager = null;

    // Register custom format validators
    this.formatValidators = new Map([
      ['color', this._validateColor.bind(this)],
      ['url', this._validateUrl.bind(this)],
      ['email', this._validateEmail.bind(this)],
      ['pattern', this._validatePattern.bind(this)]
    ]);
  }

  /**
   * ✅ NEW: Set ThemeManager for token resolution
   * @param {Object} themeManager - ThemeManager instance
   */
  setThemeManager(themeManager) {
    this.themeManager = themeManager;
    cblcarsLog.debug('[ValueValidator] ThemeManager connected for token resolution');
  }

  /**
   * Validate a value against a schema constraint
   *
   * @param {*} value - Value to validate
   * @param {Object} schema - Schema constraint
   * @param {Object} meta - Metadata (field name, overlay type, etc.)
   * @returns {Object} Validation result
   *
   * @example
   * const result = valueValidator.validate(
   *   [100, 200],
   *   { type: 'array', length: 2, items: { type: 'number' } },
   *   { field: 'position', overlayType: 'text' }
   * );
   */
  validate(value, schema, meta = {}) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Null/undefined handling
    if (value === null || value === undefined) {
      if (!schema.nullable && !schema.optional) {
        result.valid = false;
        result.errors.push({
          field: meta.field,
          type: 'required_field',
          message: `Field "${meta.field}" cannot be null or undefined`,
          severity: 'error'
        });
      }
      return result;
    }

    // ✅ NEW: Check if value is a token reference
    if (this._isTokenReference(value)) {
      return this._validateTokenValue(value, schema, meta);
    }

    // ✅ NEW: Check for enhanced property format
    if (this._isEnhancedProperty(value, schema)) {
      return this._validateEnhancedProperty(value, schema, meta);
    }

    // Type validation
    const typeResult = this._validateType(value, schema, meta);
    if (!typeResult.valid) {
      result.valid = false;
      result.errors.push(...typeResult.errors);
      return result; // Type mismatch - stop further validation
    }

    // Type-specific validation
    switch (schema.type) {
      case 'string':
        this._validateString(value, schema, meta, result);
        break;
      case 'number':
        this._validateNumber(value, schema, meta, result);
        break;
      case 'boolean':
        // No additional validation needed
        break;
      case 'array':
        this._validateArray(value, schema, meta, result);
        break;
      case 'object':
        this._validateObject(value, schema, meta, result);
        break;
    }

    // Enum validation
    if (schema.enum) {
      this._validateEnum(value, schema, meta, result);
    }

    // Custom format validation
    if (schema.format) {
      this._validateFormat(value, schema, meta, result);
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * ✅ FIXED: Check if value is a token reference
   * Token references use dot notation: colors.primary, typography.fontSize.2xl
   * Segments can start with letters OR numbers (e.g., 2xl, 3d, 4k)
   * @private
   */
  _isTokenReference(value) {
    if (typeof value !== 'string') return false;

    // Pattern: starts with letter, contains dots, segments can be alphanumeric
    // First segment must start with letter (e.g., "typography")
    // Subsequent segments can start with letter OR number (e.g., "2xl", "fontSize")
    return /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/.test(value);
    //                                    ↑↑↑↑↑↑↑↑
    // Changed from [a-zA-Z][a-zA-Z0-9]* to [a-zA-Z0-9]+
    // Now allows "2xl", "3d", "4k" as token segments
  }

  /**
   * ✅ NEW: Validate token value by resolving it first
   * @private
   */
  _validateTokenValue(value, schema, meta) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Try to resolve the token
    let resolvedValue = value;
    if (this.themeManager) {
      try {
        resolvedValue = this.themeManager.resolveToken(value);

        if (resolvedValue === null || resolvedValue === undefined) {
          // Token exists but couldn't resolve
          result.warnings.push({
            field: meta.field,
            type: 'token_resolution_failed',
            message: `Token "${value}" exists but failed to resolve`,
            value: value,
            severity: 'warning',
            suggestion: 'Check for circular references or invalid token values'
          });
          // Don't validate further, but don't fail
          return result;
        }
      } catch (error) {
        // Token doesn't exist or error resolving
        result.warnings.push({
          field: meta.field,
          type: 'token_not_found',
          message: `Token "${value}" could not be resolved`,
          value: value,
          severity: 'warning',
          suggestion: 'Verify the token exists in your theme configuration'
        });
        return result;
      }
    } else {
      // No ThemeManager available - skip validation but don't fail
      result.warnings.push({
        field: meta.field,
        type: 'token_validation_skipped',
        message: `Token "${value}" cannot be validated (ThemeManager not available)`,
        value: value,
        severity: 'info',
        suggestion: 'Token will be validated at runtime'
      });
      return result;
    }

    // Validate the resolved value
    return this._validateResolvedValue(resolvedValue, schema, meta);
  }

  /**
   * ✅ NEW: Check if value is an enhanced property format
   * Enhanced properties are complex objects that replace simple values
   * @private
   */
  _isEnhancedProperty(value, schema) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }

    // Font size enhancement: { value, scale, unit }
    if (schema.type === 'number' && 'value' in value && 'scale' in value) {
      return true;
    }

    // Glow enhancement: { color, blur, intensity }
    if (schema.type === 'boolean' && 'color' in value && 'blur' in value) {
      return true;
    }

    // Marker enhancement: { type, size, color, rotate }
    if (schema.type === 'string' && 'type' in value && !('value' in value)) {
      return true;
    }

    return false;
  }

  /**
   * ✅ NEW: Validate enhanced property format
   * @private
   */
  _validateEnhancedProperty(value, schema, meta) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Enhanced font_size: { value: number, scale: string, unit: string }
    if (schema.type === 'number' && 'value' in value) {
      if (typeof value.value !== 'number') {
        result.errors.push({
          field: meta.field,
          type: 'invalid_enhanced_property',
          message: `Enhanced property "${meta.field}" has invalid value type`,
          value: value,
          severity: 'error',
          suggestion: 'The "value" field must be a number'
        });
        result.valid = false;
      }
      // Valid enhancement - allow it
      return result;
    }

    // Enhanced glow: { color: string, blur: number, intensity: number }
    if (schema.type === 'boolean' && 'color' in value) {
      // Just warn that this is an enhanced format - don't validate deeply
      result.warnings.push({
        field: meta.field,
        type: 'enhanced_property_format',
        message: `Field "${meta.field}" uses enhanced glow format`,
        value: value,
        severity: 'info',
        suggestion: 'Enhanced properties will be processed at runtime'
      });
      return result;
    }

    // Enhanced marker: { type, size, color, rotate }
    if (schema.type === 'string' && 'type' in value) {
      result.warnings.push({
        field: meta.field,
        type: 'enhanced_property_format',
        message: `Field "${meta.field}" uses enhanced marker format`,
        value: value,
        severity: 'info',
        suggestion: 'Enhanced properties will be processed at runtime'
      });
      return result;
    }

    // Unknown enhanced format - allow with warning
    result.warnings.push({
      field: meta.field,
      type: 'enhanced_property_format',
      message: `Field "${meta.field}" uses enhanced property format`,
      value: value,
      severity: 'info',
      suggestion: 'Enhanced properties will be processed at runtime'
    });

    return result;
  }

  /**
   * ✅ NEW: Validate resolved token value against schema
   * @private
   */
  _validateResolvedValue(value, schema, meta) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Validate type of resolved value
    if (schema.type) {
      const typeResult = this._validateType(value, schema, meta);
      result.errors.push(...typeResult.errors);
      result.warnings.push(...typeResult.warnings);
    }

    // Validate format of resolved value
    if (schema.format) {
      const formatResult = this._validateFormat(value, schema, meta);
      result.errors.push(...formatResult.errors);
      result.warnings.push(...formatResult.warnings);
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate type
   *
   * @private
   */
  _validateType(value, schema, meta) {
    const result = { valid: true, errors: [] };
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    // ✅ ENHANCED: Handle multiple allowed types
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];

    if (!allowedTypes.includes(actualType)) {
      result.valid = false;
      result.errors.push({
        field: meta.field,
        type: 'invalid_type',
        message: `Field "${meta.field}" has invalid type`,
        expected: allowedTypes.length === 1 ? allowedTypes[0] : allowedTypes.join(' or '),
        actual: actualType,
        value: value,
        severity: 'error',
        suggestion: `Change "${meta.field}" to ${allowedTypes.join(' or ')}`
      });
    }

    return result;
  }

  /**
   * Validate string constraints
   *
   * @private
   */
  _validateString(value, schema, meta, result) {
    // Min length
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      result.valid = false;
      result.errors.push({
        field: meta.field,
        type: 'out_of_range',
        message: `Field "${meta.field}" is too short (minimum ${schema.minLength} characters)`,
        value: value,
        min: schema.minLength,
        actual: value.length,
        severity: 'error'
      });
    }

    // Max length
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      result.valid = false;
      result.errors.push({
        field: meta.field,
        type: 'out_of_range',
        message: `Field "${meta.field}" is too long (maximum ${schema.maxLength} characters)`,
        value: value,
        max: schema.maxLength,
        actual: value.length,
        severity: 'error'
      });
    }

    // Pattern
    if (schema.pattern) {
      const regex = schema.pattern instanceof RegExp ? schema.pattern : new RegExp(schema.pattern);
      if (!regex.test(value)) {
        result.valid = false;
        result.errors.push({
          field: meta.field,
          type: 'invalid_format',
          message: schema.errorMessage || `Field "${meta.field}" does not match required pattern`,
          value: value,
          pattern: schema.pattern.toString(),
          severity: 'error'
        });
      }
    }
  }

  /**
   * Validate number constraints
   *
   * @private
   */
  _validateNumber(value, schema, meta, result) {
    // Min value
    if (schema.min !== undefined && value < schema.min) {
      result.valid = false;
      result.errors.push({
        field: meta.field,
        type: 'out_of_range',
        message: `Field "${meta.field}" is below minimum value (${schema.min})`,
        value: value,
        min: schema.min,
        severity: 'error',
        suggestion: `Use a value >= ${schema.min}`
      });
    }

    // Max value
    if (schema.max !== undefined && value > schema.max) {
      result.valid = false,
      result.errors.push({
        field: meta.field,
        type: 'out_of_range',
        message: `Field "${meta.field}" is above maximum value (${schema.max})`,
        value: value,
        max: schema.max,
        severity: 'error',
        suggestion: `Use a value <= ${schema.max}`
      });
    }

    // Integer check
    if (schema.integer && !Number.isInteger(value)) {
      result.valid = false;
      result.errors.push({
        field: meta.field,
        type: 'invalid_format',
        message: `Field "${meta.field}" must be an integer`,
        value: value,
        severity: 'error',
        suggestion: 'Remove decimal places'
      });
    }
  }

  /**
   * Validate array constraints
   *
   * @private
   */
  _validateArray(value, schema, meta, result) {
    // Exact length
    if (schema.length !== undefined && value.length !== schema.length) {
      result.valid = false;
      result.errors.push({
        field: meta.field,
        type: 'invalid_length',
        message: `Field "${meta.field}" must have exactly ${schema.length} items`,
        expected: schema.length,
        actual: value.length,
        severity: 'error',
        suggestion: schema.errorMessage || `Array must have ${schema.length} elements`
      });
    }

    // Min length
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      result.valid = false;
      result.errors.push({
        field: meta.field,
        type: 'out_of_range',
        message: `Field "${meta.field}" must have at least ${schema.minItems} items`,
        min: schema.minItems,
        actual: value.length,
        severity: 'error'
      });
    }

    // Max length
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      result.valid = false;
      result.errors.push({
        field: meta.field,
        type: 'out_of_range',
        message: `Field "${meta.field}" must have at most ${schema.maxItems} items`,
        max: schema.maxItems,
        actual: value.length,
        severity: 'error'
      });
    }

    // Validate array items
    if (schema.items) {
      value.forEach((item, index) => {
        const itemResult = this.validate(item, schema.items, {
          ...meta,
          field: `${meta.field}[${index}]`
        });

        if (!itemResult.valid) {
          result.valid = false;
          result.errors.push(...itemResult.errors);
        }
      });
    }
  }

  /**
   * Validate object constraints
   *
   * @private
   */
  _validateObject(value, schema, meta, result) {
    // Validate nested properties
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([propName, propSchema]) => {
        if (propName in value) {
          const propResult = this.validate(value[propName], propSchema, {
            ...meta,
            field: `${meta.field}.${propName}`
          });

          if (!propResult.valid) {
            result.valid = false;
            result.errors.push(...propResult.errors);
          }
        } else if (propSchema.required && !propSchema.optional) {
          result.valid = false;
          result.errors.push({
            field: `${meta.field}.${propName}`,
            type: 'required_field',
            message: `Required property "${propName}" is missing from "${meta.field}"`,
            severity: 'error'
          });
        }
      });
    }
  }

  /**
   * Validate enum constraint
   *
   * @private
   */
  _validateEnum(value, schema, meta, result) {
    // ✅ NEW: Skip enum validation for objects (they're enhanced properties)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Objects are enhanced property formats - enum doesn't apply
      return;
    }

    const validValues = schema.enum;

    if (!validValues.includes(value)) {
      result.valid = false;

      // Try to suggest a close match
      const suggestion = this._findClosestMatch(value, validValues);

      result.errors.push({
        field: meta.field,
        type: 'invalid_enum',
        message: `Field "${meta.field}" has invalid value "${value}"`,
        value: value,
        validValues: validValues.join(', '),
        severity: 'error',
        suggestion: suggestion ? `Did you mean "${suggestion}"?` : `Use one of: ${validValues.join(', ')}`
      });
    }
  }
  /**
   * Validate custom format
   *
   * @private
   */
  _validateFormat(value, schema, meta, result) {
    const validator = this.formatValidators.get(schema.format);

    if (validator) {
      const formatResult = validator(value, schema, meta);
      if (!formatResult.valid) {
        result.valid = false;
        result.errors.push(...formatResult.errors);
      }
    } else {
      result.warnings.push({
        field: meta.field,
        type: 'unknown_format',
        message: `Unknown format validator: ${schema.format}`,
        severity: 'warning'
      });
    }
  }

  /**
   * Validate color format
   *
   * @private
   */
  _validateColor(value, schema, meta) {
    const result = { valid: true, errors: [] };

    // Check for valid color formats:
    // - Hex: #RGB, #RRGGBB, #RRGGBBAA
    // - RGB: rgb(r, g, b)
    // - RGBA: rgba(r, g, b, a)
    // - CSS variables: var(--name)
    // - Named colors (basic validation)

    const colorPatterns = [
      /^#([0-9A-Fa-f]{3}){1,2}$/,  // Hex
      /^#([0-9A-Fa-f]{8})$/,         // Hex with alpha
      /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/,  // RGB
      /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/,  // RGBA
      /^var\(--[\w-]+.*\)$/,  // CSS variable
      /^[a-z]+$/i  // Named color
    ];

    const isValid = colorPatterns.some(pattern => pattern.test(value));

    if (!isValid) {
      result.valid = false;
      result.errors.push({
        field: meta.field,
        type: 'invalid_format',
        message: `Field "${meta.field}" has invalid color format`,
        value: value,
        severity: 'error',
        suggestion: 'Use hex (#RRGGBB), rgb(), rgba(), or CSS variable format'
      });
    }

    return result;
  }

  /**
   * Validate URL format
   *
   * @private
   */
  _validateUrl(value, schema, meta) {
    const result = { valid: true, errors: [] };

    try {
      new URL(value);
    } catch (e) {
      result.valid = false;
      result.errors.push({
        field: meta.field,
        type: 'invalid_format',
        message: `Field "${meta.field}" is not a valid URL`,
        value: value,
        severity: 'error'
      });
    }

    return result;
  }

  /**
   * Validate email format
   *
   * @private
   */
  _validateEmail(value, schema, meta) {
    const result = { valid: true, errors: [] };

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(value)) {
      result.valid = false;
      result.errors.push({
        field: meta.field,
        type: 'invalid_format',
        message: `Field "${meta.field}" is not a valid email address`,
        value: value,
        severity: 'error'
      });
    }

    return result;
  }

  /**
   * Validate pattern format
   *
   * @private
   */
  _validatePattern(value, schema, meta) {
    const result = { valid: true, errors: [] };

    if (schema.pattern) {
      const regex = schema.pattern instanceof RegExp ? schema.pattern : new RegExp(schema.pattern);
      if (!regex.test(value)) {
        result.valid = false;
        result.errors.push({
          field: meta.field,
          type: 'invalid_format',
          message: `Field "${meta.field}" does not match required pattern`,
          value: value,
          pattern: schema.pattern.toString(),
          severity: 'error'
        });
      }
    }

    return result;
  }

  /**
   * Find closest match in valid values (for suggestions)
   *
   * @private
   * @param {string} value - Input value
   * @param {Array} validValues - Valid enum values
   * @returns {string|null} Closest match or null
   */
  _findClosestMatch(value, validValues) {
    if (typeof value !== 'string') return null;

    const valueLower = value.toLowerCase();

    // Exact case-insensitive match
    const exactMatch = validValues.find(v =>
      typeof v === 'string' && v.toLowerCase() === valueLower
    );
    if (exactMatch) return exactMatch;

    // Partial match
    const partialMatch = validValues.find(v =>
      typeof v === 'string' && (
        v.toLowerCase().includes(valueLower) ||
        valueLower.includes(v.toLowerCase())
      )
    );
    if (partialMatch) return partialMatch;

    return null;
  }

  /**
   * Register custom format validator
   *
   * @param {string} formatName - Format name
   * @param {Function} validator - Validator function
   */
  registerFormat(formatName, validator) {
    this.formatValidators.set(formatName, validator);
    cblcarsLog.debug(`[ValueValidator] Registered custom format: ${formatName}`);
  }
}

export default ValueValidator;