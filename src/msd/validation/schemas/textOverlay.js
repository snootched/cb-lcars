/**
 * @fileoverview Text Overlay Schema
 *
 * Validation schema for text overlays.
 * Defines required fields and constraints specific to text rendering.
 *
 * @module msd/validation/schemas/textOverlay
 */

/**
 * Text overlay validation schema
 */
export const textOverlaySchema = {
  type: 'text',
  extends: 'common',

  required: ['text', 'position'],

  properties: {
    text: {
      type: 'string',
      minLength: 1,
      errorMessage: 'Text content cannot be empty'
    },

    style: {
      type: 'object',
      optional: true,
      properties: {
        color: {
          type: 'string',
          format: 'color',
          optional: true,
          errorMessage: 'Color must be a valid color format (hex, rgb, rgba, or CSS variable)'
        },

        font_size: {
          type: 'number',
          min: 6,
          max: 200,
          optional: true,
          errorMessage: 'Font size must be between 6 and 200'
        },

        font_family: {
          type: 'string',
          optional: true
        },

        font_weight: {
          type: 'string',
          enum: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
          optional: true,
          errorMessage: 'Font weight must be "normal", "bold", or a numeric value (100-900)'
        },

        text_anchor: {
          type: 'string',
          enum: ['start', 'middle', 'end'],
          optional: true,
          errorMessage: 'Text anchor must be "start", "middle", or "end"'
        },

        alignment: {
          type: 'string',
          enum: ['left', 'center', 'right'],
          optional: true,
          errorMessage: 'Alignment must be "left", "center", or "right"'
        },

        vertical_alignment: {
          type: 'string',
          enum: ['top', 'middle', 'bottom'],
          optional: true,
          errorMessage: 'Vertical alignment must be "top", "middle", or "bottom"'
        },

        letter_spacing: {
          type: 'number',
          optional: true
        },

        line_height: {
          type: 'number',
          min: 0.5,
          max: 3,
          optional: true,
          errorMessage: 'Line height must be between 0.5 and 3'
        },

        text_transform: {
          type: 'string',
          enum: ['none', 'uppercase', 'lowercase', 'capitalize'],
          optional: true,
          errorMessage: 'Text transform must be "none", "uppercase", "lowercase", or "capitalize"'
        },

        text_decoration: {
          type: 'string',
          enum: ['none', 'underline', 'overline', 'line-through'],
          optional: true,
          errorMessage: 'Text decoration must be "none", "underline", "overline", or "line-through"'
        },

        glow: {
          type: 'boolean',
          optional: true
        },

        glow_color: {
          type: 'string',
          format: 'color',
          optional: true
        },

        glow_size: {
          type: 'number',
          min: 0,
          max: 50,
          optional: true,
          errorMessage: 'Glow size must be between 0 and 50'
        },

        shadow: {
          type: 'boolean',
          optional: true
        },

        shadow_color: {
          type: 'string',
          format: 'color',
          optional: true
        },

        shadow_offset_x: {
          type: 'number',
          optional: true
        },

        shadow_offset_y: {
          type: 'number',
          optional: true
        },

        shadow_blur: {
          type: 'number',
          min: 0,
          optional: true
        }
      }
    }
  },

  validators: [
    // Custom validator: Check if position is valid when anchor is not used
    (overlay, context) => {
      if (!overlay.anchor && !overlay.position) {
        return {
          valid: false,
          errors: [{
            field: 'position',
            type: 'required_field',
            message: 'Position is required when anchor is not specified',
            severity: 'error',
            suggestion: 'Add a "position" field or use an "anchor" reference'
          }]
        };
      }
      return { valid: true };
    }
  ]
};

export default textOverlaySchema;