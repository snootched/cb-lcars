/**
 * @fileoverview Common Overlay Schema
 *
 * Base schema inherited by all overlay types.
 * Defines validation rules for common fields (id, type, position, etc.)
 *
 * STANDARDIZATION: Aligns with cb-lcars legacy template structure
 * - Nested objects for border, padding, text
 * - snake_case for user-facing properties
 * - Supports both legacy and new formats during migration
 *
 * @module msd/validation/schemas/common
 */

/**
 * Reusable schema definitions for common style structures
 */
const borderSideSchema = {
  type: 'object',
  optional: true,
  properties: {
    color: { type: 'string', format: 'color', optional: true },
    width: { type: 'number', min: 0, max: 100, optional: true },
    style: { type: 'string', enum: ['solid', 'dashed', 'dotted', 'none'], optional: true }
  }
};

const paddingSchema = {
  type: 'object',
  optional: true,
  properties: {
    top: { type: 'number', min: 0, optional: true },
    right: { type: 'number', min: 0, optional: true },
    bottom: { type: 'number', min: 0, optional: true },
    left: { type: 'number', min: 0, optional: true }
  }
};

const colorStateSchema = {
  type: 'object',
  optional: true,
  properties: {
    default: { type: 'string', format: 'color', optional: true },
    active: { type: 'string', format: 'color', optional: true },
    inactive: { type: 'string', format: 'color', optional: true },
    unavailable: { type: 'string', format: 'color', optional: true },
    zero: { type: 'string', format: 'color', optional: true },
    non_zero: { type: 'string', format: 'color', optional: true }
  }
};

const textStyleSchema = {
  type: 'object',
  optional: true,
  properties: {
    font_size: { type: 'number', min: 6, max: 200, optional: true },
    font_family: { type: 'string', optional: true },
    font_weight: { type: 'string', enum: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'], optional: true },
    text_align: { type: 'string', enum: ['left', 'center', 'right', 'justify'], optional: true },
    text_transform: { type: 'string', enum: ['none', 'uppercase', 'lowercase', 'capitalize'], optional: true },
    line_height: { type: 'number', min: 0.5, max: 5, optional: true },
    letter_spacing: { type: 'number', optional: true },
    color: { type: ['string', 'object'], format: 'color', optional: true }, // Can be string or color state object
    padding: paddingSchema
  }
};

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

    // ✅ NEW: Tags for bulk rule targeting (Appendix C - Global Alert System)
    tags: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        pattern: /^[a-zA-Z0-9_-]+$/
      },
      optional: true,
      errorMessage: 'Tags must be an array of strings (letters, numbers, hyphens, underscores only)'
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
      optional: true,
      properties: {
        // ============================================================================
        // COLORS
        // ============================================================================
        color: {
          type: ['string', 'object'],
          format: 'color',
          optional: true,
          errorMessage: 'Color must be a valid CSS color string or color state object'
        },

        background_color: {
          type: ['string', 'object'],
          format: 'color',
          optional: true
        },

        opacity: {
          type: 'number',
          min: 0,
          max: 1,
          optional: true,
          errorMessage: 'Opacity must be between 0 and 1'
        },

        // ============================================================================
        // BORDER (Standardized nested structure)
        // ============================================================================
        border: {
          type: 'object',
          optional: true,
          properties: {
            // Default properties (apply to all sides)
            color: { type: 'string', format: 'color', optional: true },
            width: { type: 'number', min: 0, max: 100, optional: true },
            radius: { type: 'number', min: 0, optional: true },
            style: { type: 'string', enum: ['solid', 'dashed', 'dotted', 'none'], optional: true },

            // Individual sides (override defaults)
            top: borderSideSchema,
            right: borderSideSchema,
            bottom: borderSideSchema,
            left: borderSideSchema,

            // Individual corners (override default radius)
            radius_top_left: { type: 'number', min: 0, optional: true },
            radius_top_right: { type: 'number', min: 0, optional: true },
            radius_bottom_right: { type: 'number', min: 0, optional: true },
            radius_bottom_left: { type: 'number', min: 0, optional: true }
          }
        },

        // Legacy flat border properties (backward compatibility)
        border_color: { type: 'string', format: 'color', optional: true },
        border_width: { type: 'number', min: 0, max: 100, optional: true },
        border_radius: { type: 'number', min: 0, optional: true },
        border_style: { type: 'string', enum: ['solid', 'dashed', 'dotted', 'none'], optional: true },

        // Legacy individual borders (backward compatibility)
        border_top: { type: 'object', optional: true },
        border_right: { type: 'object', optional: true },
        border_bottom: { type: 'object', optional: true },
        border_left: { type: 'object', optional: true },
        border_radius_top_left: { type: 'number', min: 0, optional: true },
        border_radius_top_right: { type: 'number', min: 0, optional: true },
        border_radius_bottom_right: { type: 'number', min: 0, optional: true },
        border_radius_bottom_left: { type: 'number', min: 0, optional: true },

        // ============================================================================
        // TEXT (Nested structure - matches legacy templates)
        // ============================================================================
        text: {
          type: 'object',
          optional: true,
          properties: {
            label: textStyleSchema,
            value: textStyleSchema,
            name: textStyleSchema,
            state: textStyleSchema,

            // Support for text arrays (multiple text elements)
            texts: {
              type: 'array',
              optional: true,
              items: {
                type: 'object',
                properties: {
                  ...textStyleSchema.properties,
                  content: { type: 'string', optional: true }
                }
              }
            }
          }
        },

        // Legacy flat text properties (backward compatibility)
        font_size: { type: 'number', min: 6, max: 200, optional: true },
        font_family: { type: 'string', optional: true },
        font_weight: { type: 'string', optional: true },
        text_align: { type: 'string', optional: true },
        text_transform: { type: 'string', optional: true },
        label_color: { type: 'string', format: 'color', optional: true },
        value_color: { type: 'string', format: 'color', optional: true },
        text_color: { type: 'string', format: 'color', optional: true },

        // ============================================================================
        // LAYOUT/SPACING (Nested - matches legacy templates)
        // ============================================================================
        padding: paddingSchema,
        margin: paddingSchema,

        // Legacy flat padding (backward compatibility)
        text_padding: { type: 'number', min: 0, optional: true }
      }
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
/**
 * Export reusable schema definitions for use in type-specific schemas
 */
export const reusableSchemas = {
  borderSideSchema,
  paddingSchema,
  colorStateSchema,
  textStyleSchema
};

