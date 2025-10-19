/**
 * @fileoverview Style Validator for Style Resolver Service
 *
 * Validates resolved style values against schemas and constraints.
 * Provides helpful warnings for invalid or suboptimal values.
 *
 * @module msd/styles/StyleValidator
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Style Validator for style value validation
 *
 * Validates style values and provides warnings for issues.
 *
 * @class StyleValidator
 */
export class StyleValidator {
  constructor() {
    // Validation rules by property type
    this.rules = this._buildValidationRules();

    // Statistics
    this.stats = {
      validations: 0,
      passed: 0,
      warnings: 0,
      errors: 0
    };
  }

  /**
   * Validate a style value
   *
   * @param {string} property - Property name
   * @param {*} value - Value to validate
   * @param {Object} context - Validation context
   * @returns {Object} { valid, warnings }
   *
   * @example
   * const result = validator.validate('color', '#FF9900', context);
   * // { valid: true, warnings: [] }
   */
  validate(property, value, context = {}) {
    this.stats.validations++;

    const result = {
      valid: true,
      warnings: []
    };

    // Get validation rule for this property
    const rule = this._getRule(property);
    if (!rule) {
      // No rule, assume valid
      this.stats.passed++;
      return result;
    }

    // Type validation
    if (rule.type && !this._validateType(value, rule.type)) {
      result.warnings.push({
        severity: 'warning',
        message: `Expected type ${rule.type}, got ${typeof value}`,
        property,
        value
      });
      this.stats.warnings++;
    }

    // Range validation
    if (rule.range) {
      const rangeResult = this._validateRange(value, rule.range);
      if (!rangeResult.valid) {
        result.warnings.push({
          severity: 'warning',
          message: rangeResult.message,
          property,
          value
        });
        this.stats.warnings++;
      }
    }

    // Pattern validation
    if (rule.pattern && typeof value === 'string') {
      if (!rule.pattern.test(value)) {
        result.warnings.push({
          severity: 'warning',
          message: `Value does not match expected pattern`,
          property,
          value
        });
        this.stats.warnings++;
      }
    }

    // Custom validation
    if (rule.validate && typeof rule.validate === 'function') {
      try {
        const customResult = rule.validate(value, context);
        if (!customResult.valid) {
          result.warnings.push({
            severity: customResult.severity || 'warning',
            message: customResult.message,
            property,
            value
          });
          this.stats.warnings++;
        }
      } catch (error) {
        cblcarsLog.warn('[StyleValidator] Custom validation error:', property, error);
      }
    }

    if (result.warnings.length === 0) {
      this.stats.passed++;
    }

    return result;
  }

  /**
   * Get validation statistics
   *
   * @returns {Object} Validation statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Get validation rule for property
   * @private
   */
  _getRule(property) {
    // Try exact match first
    if (this.rules[property]) {
      return this.rules[property];
    }

    // Try pattern match
    for (const [pattern, rule] of Object.entries(this.rules)) {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
        if (regex.test(property)) {
          return rule;
        }
      }
    }

    return null;
  }

  /**
   * Validate type
   * @private
   */
  _validateType(value, expectedType) {
    const actualType = typeof value;

    if (expectedType === 'color') {
      // Color can be string or special format
      return typeof value === 'string';
    }

    if (expectedType === 'number') {
      return typeof value === 'number' && !isNaN(value);
    }

    return actualType === expectedType;
  }

  /**
   * Validate range
   * @private
   */
  _validateRange(value, range) {
    if (typeof value !== 'number') {
      return { valid: true }; // Not a number, skip range check
    }

    const { min, max } = range;

    if (min !== undefined && value < min) {
      return {
        valid: false,
        message: `Value ${value} is below minimum ${min}`
      };
    }

    if (max !== undefined && value > max) {
      return {
        valid: false,
        message: `Value ${value} exceeds maximum ${max}`
      };
    }

    return { valid: true };
  }

  /**
   * Build validation rules
   * @private
   */
  _buildValidationRules() {
    return {
      // Color properties
      color: {
        type: 'color',
        pattern: /^(#[0-9A-Fa-f]{3,8}|rgb|rgba|hsl|hsla|var\()/
      },
      fill: {
        type: 'color',
        pattern: /^(#[0-9A-Fa-f]{3,8}|rgb|rgba|hsl|hsla|var\(|none)/
      },
      stroke: {
        type: 'color',
        pattern: /^(#[0-9A-Fa-f]{3,8}|rgb|rgba|hsl|hsla|var\(|none)/
      },
      backgroundColor: {
        type: 'color',
        pattern: /^(#[0-9A-Fa-f]{3,8}|rgb|rgba|hsl|hsla|var\(|transparent)/
      },

      // Numeric properties
      fontSize: {
        type: 'number',
        range: { min: 1, max: 200 }
      },
      strokeWidth: {
        type: 'number',
        range: { min: 0, max: 50 }
      },
      opacity: {
        type: 'number',
        range: { min: 0, max: 1 }
      },

      // String properties
      fontFamily: {
        type: 'string'
      },
      textAnchor: {
        type: 'string',
        validate: (value) => {
          const valid = ['start', 'middle', 'end'].includes(value);
          return {
            valid,
            message: valid ? '' : `Invalid textAnchor: ${value}`
          };
        }
      }
    };
  }
}

export default StyleValidator;