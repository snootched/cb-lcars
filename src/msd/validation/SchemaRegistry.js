/**
 * @fileoverview Schema Registry for Overlay Validation
 *
 * Manages validation schemas for all overlay types.
 * Supports schema inheritance and custom validation rules.
 *
 * @module msd/validation/SchemaRegistry
 */

import { cblcarsLog } from '../../utils/cb-lcars-logging.js';

/**
 * Schema Registry
 *
 * Central registry for overlay validation schemas.
 */
export class SchemaRegistry {
  constructor() {
    /** @type {Map<string, Object>} Type -> Schema mapping */
    this.schemas = new Map();

    /** @type {Object} Common schema (inherited by all) */
    this.commonSchema = null;

    cblcarsLog.debug('[SchemaRegistry] Initialized');
  }

  /**
   * Register a schema for an overlay type
   *
   * @param {string} type - Overlay type (e.g., 'text', 'button')
   * @param {Object} schema - Validation schema
   *
   * @example
   * schemaRegistry.register('text', {
   *   type: 'text',
   *   required: ['text', 'position'],
   *   properties: {
   *     text: { type: 'string', minLength: 1 },
   *     position: { type: 'array', length: 2 }
   *   }
   * });
   */
  register(type, schema) {
    if (!type || typeof type !== 'string') {
      throw new Error('Schema type must be a non-empty string');
    }

    if (!schema || typeof schema !== 'object') {
      throw new Error('Schema must be an object');
    }

    this.schemas.set(type, schema);
    cblcarsLog.debug(`[SchemaRegistry] Registered schema for type: ${type}`);
  }

  /**
   * Register common schema (inherited by all types)
   *
   * @param {Object} schema - Common validation rules
   *
   * @example
   * schemaRegistry.registerCommon({
   *   required: ['id', 'type'],
   *   properties: {
   *     id: { type: 'string', pattern: /^[a-zA-Z0-9_-]+$/ },
   *     type: { type: 'string' }
   *   }
   * });
   */
  registerCommon(schema) {
    this.commonSchema = schema;
    cblcarsLog.debug('[SchemaRegistry] Registered common schema');
  }

  /**
   * Get schema for overlay type (with inheritance)
   *
   * @param {string} type - Overlay type
   * @returns {Object} Merged schema (common + type-specific)
   */
  getSchema(type) {
    const typeSchema = this.schemas.get(type);

    if (!typeSchema && !this.commonSchema) {
      return null;
    }

    // Merge common schema with type-specific schema
    if (this.commonSchema && typeSchema) {
      return this._mergeSchemas(this.commonSchema, typeSchema);
    }

    return typeSchema || this.commonSchema;
  }

  /**
   * Check if schema exists for type
   *
   * @param {string} type - Overlay type
   * @returns {boolean} True if schema exists
   */
  hasSchema(type) {
    return this.schemas.has(type);
  }

  /**
   * Get all registered overlay types
   *
   * @returns {Array<string>} Array of overlay types
   */
  getRegisteredTypes() {
    return Array.from(this.schemas.keys());
  }

  /**
   * Get count of registered schemas
   *
   * @returns {number} Schema count
   */
  getSchemaCount() {
    return this.schemas.size;
  }

  /**
   * Clear all schemas
   */
  clear() {
    this.schemas.clear();
    this.commonSchema = null;
    cblcarsLog.debug('[SchemaRegistry] Cleared all schemas');
  }

  /**
   * Merge common schema with type-specific schema
   *
   * @private
   * @param {Object} commonSchema - Common schema
   * @param {Object} typeSchema - Type-specific schema
   * @returns {Object} Merged schema
   */
  _mergeSchemas(commonSchema, typeSchema) {
    return {
      type: typeSchema.type,

      // Merge required fields
      required: [
        ...(commonSchema.required || []),
        ...(typeSchema.required || [])
      ],

      // Merge properties (type-specific overrides common)
      properties: {
        ...(commonSchema.properties || {}),
        ...(typeSchema.properties || {})
      },

      // Include custom validators from both
      validators: [
        ...(commonSchema.validators || []),
        ...(typeSchema.validators || [])
      ]
    };
  }

  /**
   * Get debug information
   *
   * @returns {Object} Debug info
   */
  getDebugInfo() {
    return {
      schemaCount: this.schemas.size,
      registeredTypes: this.getRegisteredTypes(),
      hasCommonSchema: !!this.commonSchema
    };
  }
}

export default SchemaRegistry;