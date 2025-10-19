/**
 * @fileoverview Overlay Validator - Schema-based structural validation
 *
 * Validates overlay structure against registered schemas:
 * - Required fields present
 * - Field types correct
 * - Array/object structures valid
 * - References to other entities valid
 *
 * @module msd/validation/OverlayValidator
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';
import { ValueValidator } from './ValueValidator.js';

/**
 * Overlay Validator
 *
 * Validates overlay configurations against schemas.
 */
export class OverlayValidator {
  /**
   * Create an OverlayValidator
   *
   * @param {SchemaRegistry} schemaRegistry - Schema registry instance
   */
  constructor(schemaRegistry) {
    this.schemaRegistry = schemaRegistry;
    this.valueValidator = new ValueValidator();
  }

  /**
   * Validate an overlay against its schema
   *
   * @param {Object} overlay - Overlay configuration
   * @param {Object} context - Validation context
   * @returns {Object} Validation result with errors and warnings
   *
   * @example
   * const result = overlayValidator.validate({
   *   id: 'my-text',
   *   type: 'text',
   *   text: 'Hello',
   *   position: [100, 100]
   * });
   */
  validate(overlay, context = {}) {
    const result = {
      errors: [],
      warnings: []
    };

    // Basic structure validation
    if (!overlay || typeof overlay !== 'object') {
      result.errors.push({
        field: 'overlay',
        type: 'invalid_type',
        message: 'Overlay must be an object',
        severity: 'error'
      });
      return result;
    }

    // Validate required base fields (id, type)
    this._validateBaseFields(overlay, result);

    // Get schema for overlay type
    const schema = this.schemaRegistry.getSchema(overlay.type);

    if (!schema) {
      // No schema registered - issue warning but don't fail
      result.warnings.push({
        field: 'type',
        type: 'unknown_type',
        message: `No validation schema registered for type '${overlay.type}'`,
        severity: 'warning',
        suggestion: 'This overlay type may not be validated completely'
      });
      return result;
    }

    // Validate required fields
    if (schema.required) {
      this._validateRequiredFields(overlay, schema.required, result);
    }

    // Validate properties
    if (schema.properties) {
      this._validateProperties(overlay, schema.properties, result, context);
    }

    // Run custom validators
    if (schema.validators) {
      this._runCustomValidators(overlay, schema.validators, result, context);
    }

    // Validate anchor references (if overlay uses anchors)
    if (context.anchors) {
      this._validateAnchorReferences(overlay, context.anchors, result);
    }

    // Validate attach_to references (if overlay attaches to another)
    if (context.overlays) {
      this._validateAttachmentReferences(overlay, context.overlays, result);
    }

    return result;
  }

  /**
   * Validate base fields (id, type) required for all overlays
   *
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Object} result - Validation result to populate
   */
  _validateBaseFields(overlay, result) {
    // Validate ID
    if (!overlay.id) {
      result.errors.push({
        field: 'id',
        type: 'required_field',
        message: 'Overlay is missing required field "id"',
        severity: 'error',
        suggestion: 'Add an "id" field with a unique identifier'
      });
    } else if (typeof overlay.id !== 'string') {
      result.errors.push({
        field: 'id',
        type: 'invalid_type',
        message: 'Overlay "id" must be a string',
        actual: typeof overlay.id,
        expected: 'string',
        severity: 'error'
      });
    } else if (!/^[a-zA-Z0-9_-]+$/.test(overlay.id)) {
      result.errors.push({
        field: 'id',
        type: 'invalid_format',
        message: 'Overlay "id" contains invalid characters',
        value: overlay.id,
        severity: 'error',
        suggestion: 'Use only letters, numbers, hyphens, and underscores'
      });
    }

    // Validate type
    if (!overlay.type) {
      result.errors.push({
        field: 'type',
        type: 'required_field',
        message: 'Overlay is missing required field "type"',
        severity: 'error',
        suggestion: 'Add a "type" field (e.g., "text", "button", "line")'
      });
    } else if (typeof overlay.type !== 'string') {
      result.errors.push({
        field: 'type',
        type: 'invalid_type',
        message: 'Overlay "type" must be a string',
        actual: typeof overlay.type,
        expected: 'string',
        severity: 'error'
      });
    }
  }

  /**
   * Validate required fields from schema
   *
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Array<string>} required - Required field names
   * @param {Object} result - Validation result
   */
  _validateRequiredFields(overlay, required, result) {
    required.forEach(fieldName => {
      if (!(fieldName in overlay)) {
        result.errors.push({
          field: fieldName,
          type: 'required_field',
          message: `Required field "${fieldName}" is missing`,
          severity: 'error',
          suggestion: `Add the "${fieldName}" field to your overlay configuration`
        });
      }
    });
  }

  /**
   * Validate properties against schema definitions
   *
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Object} properties - Schema property definitions
   * @param {Object} result - Validation result
   * @param {Object} context - Validation context
   */
  _validateProperties(overlay, properties, result, context) {
    Object.entries(properties).forEach(([propName, propSchema]) => {
      // Skip if field not present and is optional
      if (!(propName in overlay)) {
        if (!propSchema.optional && !propSchema.required) {
          // Field is neither required nor explicitly optional - assume optional
          return;
        }
        if (propSchema.optional) {
          return;
        }
      }

      const value = overlay[propName];

      // Validate using ValueValidator
      const valueResult = this.valueValidator.validate(
        value,
        propSchema,
        { field: propName, overlayType: overlay.type, context }
      );

      if (!valueResult.valid) {
        result.errors.push(...valueResult.errors);
        result.warnings.push(...valueResult.warnings);
      }
    });
  }

  /**
   * Run custom validator functions
   *
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Array<Function>} validators - Custom validator functions
   * @param {Object} result - Validation result
   * @param {Object} context - Validation context
   */
  _runCustomValidators(overlay, validators, result, context) {
    validators.forEach(validator => {
      try {
        const validatorResult = validator(overlay, context);

        if (validatorResult && !validatorResult.valid) {
          if (validatorResult.errors) {
            result.errors.push(...validatorResult.errors);
          }
          if (validatorResult.warnings) {
            result.warnings.push(...validatorResult.warnings);
          }
        }
      } catch (error) {
        cblcarsLog.error('[OverlayValidator] Custom validator failed:', error);
        result.warnings.push({
          field: 'validator',
          type: 'validator_error',
          message: `Custom validator failed: ${error.message}`,
          severity: 'warning'
        });
      }
    });
  }

  /**
   * Validate anchor references
   *
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Object} anchors - Available anchors
   * @param {Object} result - Validation result
   */
  _validateAnchorReferences(overlay, anchors, result) {
    const anchorFields = ['anchor', 'position'];

    anchorFields.forEach(field => {
      const value = overlay[field];

      // Check if it's an anchor reference (string)
      if (typeof value === 'string' && value.length > 0) {
        // Check if anchor exists
        if (!anchors[value]) {
          result.errors.push({
            field: field,
            type: 'invalid_reference',
            reference: value,
            referenceType: 'anchors',
            message: `Anchor "${value}" not found`,
            severity: 'error',
            suggestion: `Ensure anchor "${value}" is defined in your configuration`,
            helpUrl: 'https://docs.cb-lcars.com/msd/anchors'
          });
        }
      }
    });
  }

  /**
   * Validate attachment references (attach_to, attachTo)
   *
   * @private
   * @param {Object} overlay - Overlay configuration
   * @param {Array<Object>} overlays - All overlays
   * @param {Object} result - Validation result
   */
  _validateAttachmentReferences(overlay, overlays, result) {
    const attachFields = ['attach_to', 'attachTo'];

    attachFields.forEach(field => {
      const value = overlay[field];

      if (typeof value === 'string' && value.length > 0) {
        // Check if target overlay exists
        const targetExists = overlays.some(o => o.id === value);

        if (!targetExists) {
          result.errors.push({
            field: field,
            type: 'invalid_reference',
            reference: value,
            referenceType: 'overlays',
            message: `Target overlay "${value}" not found`,
            severity: 'error',
            suggestion: `Ensure overlay "${value}" is defined in your configuration`,
            helpUrl: 'https://docs.cb-lcars.com/msd/attachments'
          });
        }

        // Warn about self-attachment
        if (value === overlay.id) {
          result.warnings.push({
            field: field,
            type: 'self_reference',
            message: `Overlay "${overlay.id}" is attached to itself`,
            severity: 'warning',
            suggestion: 'Attach to a different overlay or remove the attachment'
          });
        }
      }
    });
  }
}

export default OverlayValidator;