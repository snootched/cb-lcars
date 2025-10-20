/**
 * @fileoverview Common Overlay Schema
 *
 * Base schema inherited by all overlay types.
 * Defines validation rules for common fields (id, type, position, etc.)
 *
 * @module msd/validation/schemas/common
 */

/**
 * Common overlay schema
 *
 * Inherited by all overlay types to provide base validation.
 */
export const commonSchema = {
  type: 'common',

  required: ['id', 'type'],

  properties: {
    id: {
      type: 'string',
      minLength: 1,
      pattern: /^[a-zA-Z0-9_-]+$/,
      errorMessage: 'ID must contain only letters, numbers, hyphens, and underscores'
    },

    type: {
      type: 'string',
      minLength: 1,
      errorMessage: 'Overlay type is required'
    },

    // ✅ ENHANCED: Accept array OR string (anchor reference)
    position: {
      type: ['array', 'string'],
      length: 2,  // Only applies when type is array
      items: {    // Only applies when type is array
        type: 'number'
      },
      errorMessage: 'Position must be [x, y] coordinates or an anchor reference string'
    },

    size: {
      type: 'array',
      length: 2,
      items: {
        type: 'number',
        min: 0
      },
      optional: true,
      errorMessage: 'Size must be an array of 2 positive numbers [width, height]'
    },

    rotation: {
      type: 'number',
      min: -360,
      max: 360,
      optional: true,
      errorMessage: 'Rotation must be between -360 and 360 degrees'
    },

    opacity: {
      type: 'number',
      min: 0,
      max: 1,
      optional: true,
      errorMessage: 'Opacity must be between 0 and 1'
    },

    visible: {
      type: 'boolean',
      optional: true
    },

    anchor: {
      type: 'string',
      optional: true,
      errorMessage: 'Anchor must be a string reference to an anchor point'
    },

    attach_to: {
      type: 'string',
      optional: true,
      errorMessage: 'attach_to must be a string reference to another overlay ID'
    },

    attachTo: {
      type: 'string',
      optional: true,
      errorMessage: 'attachTo must be a string reference to another overlay ID'
    },

    style: {
      type: 'object',
      optional: true
    },

    animations: {
      type: 'array',
      optional: true,
      items: {
        type: 'object'
      }
    },

    rules: {
      type: 'array',
      optional: true,
      items: {
        type: 'object'
      }
    }
  }
};

export default commonSchema;